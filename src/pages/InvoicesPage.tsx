// src/pages/InvoicesPage.tsx
// Upgraded to ROOFZEUS dark command-center theme + Framer Motion + CountUp.
// Preserves all existing helper functions, listeners, Firestore mappings, and modal logic.

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  setDoc,
  updateDoc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import type { FieldValue } from "firebase/firestore";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
  FileText,
  CheckCircle,
  Plus,
  Printer,
  Search,
  Filter,
} from "lucide-react";
import { createPortal } from "react-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import CountUp from "react-countup";

import { useOrg } from "../contexts/OrgContext";
import { db } from "../firebase/firebaseConfig";
import type {
  InvoiceDoc,
  Job,
  InvoiceLine,
  InvoiceStatus,
} from "../types/types";
import { jobConverter } from "../types/types";

import logo from "../assets/rogers-roofing.webp";

// Helper to format money from cents to dollars
function money(cents: number | null | undefined): string {
  const v = typeof cents === "number" ? cents : 0;
  return (v / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Generate a human friendly invoice number like INV-2025-000123
async function generateInvoiceNumber(orgId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  try {
    const q = query(
      collection(db, "invoices"),
      where("orgId", "==", orgId),
      where("number", ">=", prefix),
      where("number", "<=", prefix + "\uffff"),
      orderBy("number", "desc"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    let maxSeq = 0;
    snap.forEach((d) => {
      const num = (d.data() as InvoiceDoc).number;
      const parts = num.split("-");
      const seqStr = parts[2];
      const seq = Number(seqStr);
      if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
    });
    const nextSeq = (maxSeq + 1).toString().padStart(6, "0");
    return `${prefix}${nextSeq}`;
  } catch {
    const ts = Date.now().toString().slice(-6);
    return `${prefix}${ts}`;
  }
}

/**
 * Modal for creating a new invoice.
 * (Logic preserved; styling upgraded to dark theme.)
 */
function NewInvoiceModal({
  orgId,
  jobs,
  onClose,
  onCreated,
  pushToast,
}: {
  orgId: string;
  jobs: Job[];
  onClose: () => void;
  onCreated?: (invoice: InvoiceDoc) => void;
  pushToast: (t: {
    status: "success" | "error" | "loading";
    title: string;
    message: string;
  }) => void;
}) {
  if (typeof document === "undefined") return null;

  const [jobId, setJobId] = useState<string>(jobs[0]?.id ?? "");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [extras, setExtras] = useState<{ label: string; amount: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingMode, setSavingMode] = useState<InvoiceStatus | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === jobId) ?? null,
    [jobs, jobId]
  );

  const laborCents = selectedJob?.expenses?.totalPayoutsCents ?? 0;
  const materialsCents = selectedJob?.expenses?.totalMaterialsCents ?? 0;

  const extraCents = useMemo(() => {
    return extras.reduce((sum, ex) => {
      const amt = Number(ex.amount);
      if (Number.isFinite(amt) && amt > 0) return sum + Math.round(amt * 100);
      return sum;
    }, 0);
  }, [extras]);

  const subtotalCents = laborCents + materialsCents + extraCents;
  const taxCents = 0; // reserved for future
  const totalCents = subtotalCents + taxCents;

  function addExtra() {
    setExtras((prev) => [...prev, { label: "", amount: "" }]);
  }
  function removeExtra(idx: number) {
    setExtras((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit(status: InvoiceStatus) {
    setFormError(null);

    if (!orgId) {
      setFormError("Organization not loaded.");
      return;
    }
    if (!selectedJob) {
      setFormError("Please select a job to invoice.");
      return;
    }

    const lines: InvoiceLine[] = [];
    if (laborCents > 0) {
      lines.push({
        id: "labor",
        label: "Labor (payouts)",
        amountCents: laborCents,
      });
    }
    if (materialsCents > 0) {
      lines.push({
        id: "materials",
        label: "Materials",
        amountCents: materialsCents,
      });
    }
    extras.forEach((ex, idx) => {
      const amt = Number(ex.amount);
      if (ex.label.trim() && Number.isFinite(amt) && amt > 0) {
        lines.push({
          id: `extra-${idx}`,
          label: ex.label.trim(),
          amountCents: Math.round(amt * 100),
        });
      }
    });

    if (lines.length === 0) {
      setFormError("At least one line item is required.");
      return;
    }

    pushToast({
      status: "loading",
      title: status === "sent" ? "Sending invoice…" : "Saving invoice…",
      message:
        status === "sent"
          ? "Creating the invoice and sending it to the customer."
          : "Creating your invoice draft.",
    });

    setSavingMode(status);
    setSaving(true);

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    async function confirmEmailDelivery(invoiceId: string): Promise<boolean> {
      const maxAttempts = 8;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const invSnap = await getDoc(doc(db, "invoices", invoiceId));
          if (invSnap.exists()) {
            const invData = invSnap.data() as any;
            const resendId = invData?.lastEmailResendId ?? null;
            const sentAt = invData?.lastEmailSentAt ?? null;
            if (resendId) return true;

            const sentMs =
              sentAt?.toDate && typeof sentAt.toDate === "function"
                ? sentAt.toDate().getTime()
                : null;

            if (
              sentMs &&
              Date.now() - sentMs >= 0 &&
              Date.now() - sentMs < 10 * 60 * 1000
            ) {
              return true;
            }
          }
        } catch {
          // ignore
        }
        await sleep(250 + attempt * 250);
      }
      return false;
    }

    try {
      const number = await generateInvoiceNumber(orgId);
      const docRef = doc(collection(db, "invoices"));

      const custName = customerName.trim();
      const custEmail = customerEmail.trim();
      const custPhone = customerPhone.trim();
      const desc = description.trim();

      const customer =
        custName || custEmail || custPhone
          ? {
              ...(custName ? { name: custName } : {}),
              ...(custEmail ? { email: custEmail } : {}),
              ...(custPhone ? { phone: custPhone } : {}),
            }
          : undefined;

      const addressSnapshot =
        typeof selectedJob.address === "string"
          ? {
              fullLine: selectedJob.address,
              line1: selectedJob.address,
              city: "",
              state: "",
              zip: "",
            }
          : {
              fullLine: selectedJob.address.fullLine ?? "",
              line1: selectedJob.address.street ?? "",
              city: selectedJob.address.city ?? "",
              state: selectedJob.address.state ?? "",
              zip: selectedJob.address.postalCode ?? "",
            };

      const invoice: InvoiceDoc = {
        id: docRef.id,
        kind: "invoice",
        jobId: selectedJob.id,
        number,
        ...(customer ? { customer } : {}),
        addressSnapshot,
        ...(desc ? { description: desc } : {}),
        lines,
        money: {
          materialsCents,
          laborCents,
          extraCents,
          subtotalCents,
          taxCents,
          totalCents,
        },
        createdAt: serverTimestamp() as unknown as FieldValue,
        updatedAt: serverTimestamp() as unknown as FieldValue,
        ...(status === "sent"
          ? { sentAt: serverTimestamp() as unknown as FieldValue }
          : {}),
        status,
        orgId,
      };

      await setDoc(docRef, invoice as any);

      if (status === "sent") {
        const email = customerEmail.trim();

        if (!email) {
          pushToast({
            status: "success",
            title: "Invoice saved",
            message: "Marked as sent, but no customer email was provided.",
          });
        } else {
          try {
            const functions = getFunctions(undefined, "us-central1");
            const sendInvoiceEmail = httpsCallable(
              functions,
              "sendInvoiceEmail"
            );
            const res = await sendInvoiceEmail({ invoiceId: docRef.id, email });
            const data = res?.data as any;

            if (data?.skipped) {
              pushToast({
                status: "success",
                title: "Invoice already sent",
                message:
                  data?.reason === "in_flight"
                    ? "A send was already in progress — skipping duplicate."
                    : "This invoice was already emailed recently — skipping duplicate.",
              });
            } else {
              pushToast({
                status: "success",
                title: "Invoice sent",
                message: "Customer has been emailed the invoice link.",
              });
            }
          } catch (emailErr: any) {
            // eslint-disable-next-line no-console
            console.error("sendInvoiceEmail callable threw:", emailErr);

            const confirmed = await confirmEmailDelivery(docRef.id);
            if (confirmed) {
              pushToast({
                status: "success",
                title: "Invoice sent",
                message: "Email was sent.",
              });
            } else {
              pushToast({
                status: "error",
                title: "Invoice saved — delivery not confirmed",
                message:
                  "The invoice was created, but we couldn’t confirm the email delivery. The customer may still have received it. If needed, open the invoice and resend.",
              });
            }
          }
        }
      } else {
        pushToast({
          status: "success",
          title: "Invoice saved",
          message:
            status === "draft" ? "Saved as a draft." : `Saved as "${status}".`,
        });
      }

      onCreated?.(invoice);
      onClose();
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setFormError(msg);
      pushToast({
        status: "error",
        title: status === "sent" ? "Send failed" : "Save failed",
        message: msg,
      });
    } finally {
      setSaving(false);
      setSavingMode(null);
    }
  }

  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const content = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-3">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        aria-label="Close"
      />

      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--color-border)]/70 bg-[var(--color-surface)] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)]/60 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-accent-gold)]/15 text-[var(--color-accent-gold)]">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-text)]">
                Create invoice
              </h2>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Generate an invoice from a job.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--color-border)]/70 bg-[var(--color-card)] px-2 py-1 text-[11px] text-[var(--color-text)]/80 hover:bg-[var(--color-card-hover)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {formError && (
            <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {formError}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                Job
              </label>
              <select
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                disabled={saving || jobs.length === 0}
                className="mt-1 w-full rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent-gold)]/40 disabled:opacity-60"
              >
                {jobs.length === 0 && <option>No jobs available</option>}
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {typeof j.address === "string"
                      ? j.address
                      : j.address.fullLine}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                Customer name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                disabled={saving}
                className="mt-1 w-full rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent-gold)]/40 disabled:opacity-60"
                placeholder="e.g. Jane Doe"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                Customer email
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                disabled={saving}
                className="mt-1 w-full rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent-gold)]/40 disabled:opacity-60"
                placeholder="email@example.com"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                Customer phone
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                disabled={saving}
                className="mt-1 w-full rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent-gold)]/40 disabled:opacity-60"
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={saving}
                rows={2}
                placeholder="Describe the work performed"
                className="mt-1 w-full resize-none rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent-gold)]/40 disabled:opacity-60"
              />
            </div>

            <div>
              <div className="rounded-xl border border-[var(--color-border)]/70 bg-[var(--color-card)] px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                  Labor
                </div>
                <div className="mt-1 text-lg font-semibold text-[var(--color-text)]">
                  {money(laborCents)}
                </div>
              </div>
            </div>

            <div>
              <div className="rounded-xl border border-[var(--color-border)]/70 bg-[var(--color-card)] px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                  Materials
                </div>
                <div className="mt-1 text-lg font-semibold text-[var(--color-text)]">
                  {money(materialsCents)}
                </div>
              </div>
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                  Extras
                </label>
                <button
                  type="button"
                  onClick={addExtra}
                  disabled={saving}
                  className="flex items-center gap-1 text-xs text-[var(--color-text)]/80 hover:text-[var(--color-text)] disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" /> Add
                </button>
              </div>

              {extras.length === 0 && (
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  No extras added
                </p>
              )}

              {extras.map((ex, idx) => (
                <div
                  key={idx}
                  className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end"
                >
                  <div className="flex-1">
                    <label className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                      Label
                    </label>
                    <input
                      type="text"
                      value={ex.label}
                      onChange={(e) => {
                        const v = e.target.value;
                        setExtras((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, label: v } : item
                          )
                        );
                      }}
                      disabled={saving}
                      className="mt-1 w-full rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent-gold)]/40 disabled:opacity-60"
                      placeholder="e.g. Dumpster rental"
                    />
                  </div>

                  <div className="w-32">
                    <label className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                      Amount ($)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={ex.amount}
                      onChange={(e) => {
                        const v = e.target.value;
                        setExtras((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, amount: v } : item
                          )
                        );
                      }}
                      disabled={saving}
                      className="mt-1 w-full rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent-gold)]/40 disabled:opacity-60"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="flex items-center justify-center sm:justify-start">
                    <button
                      type="button"
                      onClick={() => removeExtra(idx)}
                      disabled={saving}
                      className="ml-2 inline-flex items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 px-2 py-2 text-xs text-red-200 hover:bg-red-500/15 disabled:opacity-60"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="sm:col-span-2 mt-3">
              <div className="rounded-xl border border-[var(--color-border)]/70 bg-[var(--color-card)] px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                  Subtotal
                </div>
                <div className="mt-1 text-lg font-semibold text-[var(--color-text)]">
                  {money(subtotalCents)}
                </div>
                {extraCents > 0 && (
                  <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">
                    Extras: {money(extraCents)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse gap-2 border-t border-[var(--color-border)]/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-card)] px-4 py-2 text-sm text-[var(--color-text)]/85 hover:bg-[var(--color-card-hover)] disabled:opacity-60"
          >
            Cancel
          </button>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => submit("draft")}
              disabled={saving}
              className="rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-card)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-card-hover)] disabled:opacity-60"
            >
              {saving && savingMode === "draft" ? "Saving…" : "Save draft"}
            </button>

            <button
              type="button"
              onClick={() => submit("sent")}
              disabled={saving}
              className="rounded-xl bg-[var(--color-accent-gold)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)] hover:bg-[var(--btn-hover-bg)] disabled:opacity-60"
            >
              {saving && savingMode === "sent" ? "Sending…" : "Save & Send"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );

  return createPortal(content, document.body);
}

/**
 * Modal to preview and print an invoice.
 * (Printable document stays white; outer shell upgraded to match dark UI.)
 */
function InvoicePreviewModal({
  invoice,
  job,
  onClose,
  onMarkPaid,
  saving,
}: {
  invoice: InvoiceDoc;
  job: Job | null;
  onClose: () => void;
  onMarkPaid: () => Promise<void>;
  saving: boolean;
}) {
  if (typeof document === "undefined") return null;

  const jobAddr = useMemo(() => {
    if (!job) return { display: "", city: "", state: "", zip: "" };
    const a = job.address;
    if (typeof a === "string")
      return { display: a, city: "", state: "", zip: "" };
    return {
      display: a.fullLine ?? "",
      city: a.city ?? "",
      state: a.state ?? "",
      zip: a.postalCode ?? "",
    };
  }, [job]);

  const creationDate = useMemo(() => {
    let dt: Date | null = null;
    const anyDate = invoice.createdAt as any;
    if (anyDate?.toDate) dt = anyDate.toDate();
    else if (anyDate instanceof Date) dt = anyDate;
    if (!dt) return "";
    return dt.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [invoice.createdAt]);

  const subtotal = invoice.money?.subtotalCents ?? 0;
  const tax = invoice.money?.taxCents ?? 0;
  const total = invoice.money?.totalCents ?? 0;

  const content = (
    <div
      className="paystub-print fixed inset-0 z-50 grid place-items-center bg-black/70 p-4
      print:static print:bg-transparent print:p-0 print:m-0 print:w-auto print:z-auto"
    >
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.99 }}
        transition={{ duration: 0.2 }}
        className="paystub-print-inner w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl
        print:max-w-none print:rounded-none print:shadow-none print:border-none print:p-0 print:w-full print:mx-0 print:m-0"
      >
        <div className="mb-4 flex flex-col sm:flex-row items-start justify-between gap-4">
          <div>
            <div className="flex gap-2 items-center">
              <img src={logo} className="max-w-[100px]" alt="Company Logo" />
              <div>
                <h2 className="text-2xl font-semibold">
                  Roger&apos;s Roofing & Contracting LLC
                </h2>
                <h1 className="text-sm">3618 Angus Crossing</h1>
                <p className="mt-0 text-xs">San Antonio, Texas 75245</p>
              </div>
            </div>

            {invoice.customer && (
              <div className="mt-4">
                <h3 className="text-sm font-medium">Bill To:</h3>
                {invoice.customer.name && (
                  <p className="text-sm">{invoice.customer.name}</p>
                )}
                {invoice.customer.email && (
                  <p className="text-sm">{invoice.customer.email}</p>
                )}
                {invoice.customer.phone && (
                  <p className="text-sm">{invoice.customer.phone}</p>
                )}
              </div>
            )}

            {job && (
              <div className="mt-3 text-sm">
                <h3 className="font-medium">Job Address:</h3>
                <p>{jobAddr.display}</p>
                {jobAddr.city && (
                  <p>
                    {[jobAddr.city, jobAddr.state, jobAddr.zip]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="text-right text-sm">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-300 px-3 py-2 text-[11px] text-gray-700 hover:bg-gray-100 print:hidden"
            >
              Close
            </button>

            <div className="mt-6">
              <p className="text-xs text-gray-500">Invoice #</p>
              <p className="text-base font-semibold">{invoice.number}</p>
              <p className="mt-2 text-xs text-gray-500">Date</p>
              <p className="text-base font-semibold">{creationDate}</p>
            </div>
          </div>
        </div>

        {invoice.description && (
          <div className="mb-4 text-sm">
            <p className="font-medium">Description</p>
            <p>{invoice.description}</p>
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
          <table className="min-w-full text-xs sm:text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((ln) => (
                <tr key={ln.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 align-top text-sm text-gray-800">
                    {ln.label}
                  </td>
                  <td className="px-3 py-2 align-top text-right text-sm font-semibold text-gray-900">
                    {money(ln.amountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col items-end">
          <div className="text-right text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium text-gray-800">
                {money(subtotal)}
              </span>
            </div>
            <div className="flex justify-between gap-4 mt-1">
              <span className="text-gray-500">Tax</span>
              <span className="font-medium text-gray-800">{money(tax)}</span>
            </div>
            <div className="flex justify-between gap-4 mt-2 border-t border-gray-200 pt-2">
              <span className="text-gray-500">Total</span>
              <span className="font-semibold text-gray-900">
                {money(total)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl border border-gray-300 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 print:hidden"
          >
            <Printer className="inline-block h-4 w-4 mr-1" /> Print / Save PDF
          </button>

          {invoice.status !== "paid" && (
            <button
              type="button"
              onClick={onMarkPaid}
              disabled={saving}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 print:hidden"
            >
              {saving ? "Marking…" : "Mark as paid"}
            </button>
          )}

          {invoice.status === "paid" && (
            <span className="inline-flex items-center gap-1 rounded-xl bg-green-100 px-3 py-2 text-xs font-medium text-green-700">
              <CheckCircle className="h-4 w-4" /> Paid
            </span>
          )}
        </div>
      </motion.div>
    </div>
  );

  return createPortal(content, document.body);
}

/**
 * Main InvoicesPage component.
 * Upgraded: dark theme, animated layout, CountUp summary, better UX hierarchy.
 */
export default function InvoicesPage() {
  const { orgId, loading: orgLoading } = useOrg();
  const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceStatus>(
    "all"
  );
  const [openForm, setOpenForm] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDoc | null>(
    null
  );
  const [markingPaid, setMarkingPaid] = useState(false);

  // ---- Pagination (UI only) ----
  const INVOICES_PER_PAGE = 10;
  const [invoicesPage, setInvoicesPage] = useState<number>(1);

  // ---- Global toast (kept) ----
  type ToastStatus = "success" | "error" | "loading";
  type ToastState = {
    status: ToastStatus;
    title: string;
    message: string;
  } | null;

  const [toast, setToast] = useState<ToastState>(null);

  function pushToast(next: NonNullable<ToastState>) {
    setToast(next);
  }

  useEffect(() => {
    if (!toast) return;
    if (toast.status === "loading") return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  // Subscribe to invoices for the current organisation
  useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, "invoices"),
      where("orgId", "==", orgId),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: InvoiceDoc[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<InvoiceDoc, "id">),
      }));
      setInvoices(list);
    });
    return () => unsub();
  }, [orgId]);

  // Load jobs for invoice creation dropdown
  useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, "jobs").withConverter(jobConverter),
      where("orgId", "==", orgId),
      orderBy("updatedAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setJobs(snap.docs.map((d) => d.data()));
    });
    return () => unsub();
  }, [orgId]);

  // Derived stats
  const totalInvoices = invoices.length;
  const totalAmount = invoices.reduce(
    (sum, inv) => sum + (inv.money?.totalCents ?? 0),
    0
  );
  const outstandingAmount = invoices.reduce((sum, inv) => {
    if (inv.status === "draft" || inv.status === "sent")
      return sum + (inv.money?.totalCents ?? 0);
    return sum;
  }, 0);
  const paidAmount = invoices.reduce((sum, inv) => {
    if (inv.status === "paid") return sum + (inv.money?.totalCents ?? 0);
    return sum;
  }, 0);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    let list = invoices;
    if (statusFilter !== "all")
      list = list.filter((inv) => inv.status === statusFilter);
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      list = list.filter((inv) => {
        const haystack = [
          inv.number,
          inv.customer?.name,
          inv.customer?.email,
          inv.jobId,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      });
    }
    return list;
  }, [invoices, statusFilter, searchTerm]);

  // ---- Pagination derived ----
  const invoicesTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredInvoices.length / INVOICES_PER_PAGE));
  }, [filteredInvoices.length]);

  useEffect(() => {
    setInvoicesPage((p: number) =>
      Math.min(Math.max(1, p), invoicesTotalPages)
    );
  }, [invoicesTotalPages]);

  const pagedInvoices = useMemo(() => {
    const start = (invoicesPage - 1) * INVOICES_PER_PAGE;
    return filteredInvoices.slice(start, start + INVOICES_PER_PAGE);
  }, [filteredInvoices, invoicesPage]);

  const selectedInvoiceJob = useMemo(() => {
    if (!selectedInvoice) return null;
    return jobs.find((j) => j.id === selectedInvoice.jobId) ?? null;
  }, [selectedInvoice, jobs]);

  async function markInvoicePaid(inv: InvoiceDoc) {
    if (!orgId) return;
    setMarkingPaid(true);
    try {
      const ref = doc(db, "invoices", inv.id);
      await updateDoc(ref, {
        status: "paid",
        paidAt: serverTimestamp() as unknown as FieldValue,
        updatedAt: serverTimestamp() as unknown as FieldValue,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    } finally {
      setMarkingPaid(false);
      setSelectedInvoice(null);
    }
  }

  if (orgLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] p-6 text-[var(--color-text)]">
        Loading invoices…
      </div>
    );
  }
  if (!orgId) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] p-8 text-red-200">
        You are not linked to an organization. Please contact your admin.
      </div>
    );
  }

  const ease = [0.16, 1, 0.3, 1] as const;
  const stagger: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.06 } },
  };
  const fadeUp: Variants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease } },
  };

  function StatusPill({ status }: { status: InvoiceStatus }) {
    const base =
      "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold capitalize";
    if (status === "paid")
      return (
        <span
          className={`${base} border-emerald-400/30 bg-emerald-400/10 text-emerald-100`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
          paid
        </span>
      );
    if (status === "sent")
      return (
        <span
          className={`${base} border-[var(--color-accent-gold)]/30 bg-[var(--color-accent-gold)]/10 text-[var(--color-text)]`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent-gold)]" />
          sent
        </span>
      );
    if (status === "draft")
      return (
        <span
          className={`${base} border-white/15 bg-white/5 text-[var(--color-text)]/80`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
          draft
        </span>
      );
    return (
      <span className={`${base} border-red-400/30 bg-red-400/10 text-red-100`}>
        <span className="h-1.5 w-1.5 rounded-full bg-red-300" />
        {status}
      </span>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto w-[min(1180px,94vw)] space-y-6 py-8">
        {/* Header */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="space-y-4"
        >
          <motion.div
            variants={fadeUp}
            className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
          >
            <div>
              <h1 className="text-2xl font-semibold text-[var(--color-text)]">
                Invoices
              </h1>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Create, send, and track customer invoices for your jobs.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpenForm(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent-gold)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)] hover:bg-[var(--btn-hover-bg)]"
              >
                <Plus className="h-4 w-4" />
                New Invoice
              </button>
            </div>
          </motion.div>

          {/* Summary cards */}
          <motion.section
            variants={fadeUp}
            className="rounded-2xl border border-[var(--color-border)]/70 bg-[var(--color-card)] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-text)]">
                  Overview
                </h2>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Live totals across your organization.
                </p>
              </div>

              <div className="text-xs text-[var(--color-muted)]">
                {filteredInvoices.length} visible / {totalInvoices} total
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
                  Total invoices
                </div>
                <div className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
                  <CountUp end={totalInvoices} duration={0.7} />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
                  Total amount
                </div>
                <div className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
                  <CountUp
                    end={totalAmount / 100}
                    decimals={2}
                    prefix="$"
                    duration={0.85}
                    separator=","
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
                  Outstanding
                </div>
                <div className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
                  <CountUp
                    end={outstandingAmount / 100}
                    decimals={2}
                    prefix="$"
                    duration={0.85}
                    separator=","
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
                  Paid
                </div>
                <div className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
                  <CountUp
                    end={paidAmount / 100}
                    decimals={2}
                    prefix="$"
                    duration={0.85}
                    separator=","
                  />
                </div>
              </div>
            </div>
          </motion.section>

          {/* Filters */}
          <motion.section
            variants={fadeUp}
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
                <input
                  type="text"
                  placeholder="Search invoices… (number, customer, email)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full min-w-[280px] rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-card)] py-2 pl-9 pr-3 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-muted)] focus:ring-2 focus:ring-[var(--color-accent-gold)]/40"
                />
              </div>

              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-card)] py-2 pl-9 pr-8 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent-gold)]/40"
                >
                  <option value="all">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                  <option value="void">Void</option>
                </select>
              </div>
            </div>

            <div className="text-xs text-[var(--color-muted)]">
              Tip: click <span className="text-[var(--color-text)]">View</span>{" "}
              to print or mark as paid.
            </div>
          </motion.section>
        </motion.div>

        {/* Table */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease }}
          className="rounded-2xl border border-[var(--color-border)]/70 bg-[var(--color-card)] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text)]">
                Invoices
              </h3>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Showing the most recent invoices first.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs text-[var(--color-muted)]">
              Page{" "}
              <span className="font-semibold text-[var(--color-text)]">
                {invoicesPage}
              </span>{" "}
              / {invoicesTotalPages}
            </div>
          </div>

          <div className="relative overflow-auto section-scroll-invoices">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-30 border-b border-white/10 bg-[var(--color-surface)]/60 text-[11px] uppercase tracking-wide text-[var(--color-muted)] backdrop-blur">
                <tr>
                  <th className="px-3 py-2 text-left">Number</th>
                  <th className="px-3 py-2 text-left">Job</th>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-8 text-center text-[var(--color-muted)]"
                    >
                      No invoices found
                    </td>
                  </tr>
                )}

                {pagedInvoices.map((inv) => {
                  const job = jobs.find((j) => j.id === inv.jobId);
                  const address = job
                    ? typeof job.address === "string"
                      ? job.address
                      : job.address.fullLine
                    : inv.jobId;

                  let dateStr = "";
                  const dtAny = inv.createdAt as any;
                  if (dtAny?.toDate)
                    dateStr = dtAny.toDate().toLocaleDateString();
                  else if (dtAny instanceof Date)
                    dateStr = dtAny.toLocaleDateString();

                  return (
                    <motion.tr
                      key={inv.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, ease }}
                      className="border-t border-white/10 hover:bg-white/5"
                    >
                      <td className="px-3 py-3 align-top text-[var(--color-text)]/90">
                        {inv.number}
                      </td>

                      <td className="px-3 py-3 align-top">
                        <div className="font-medium text-[var(--color-text)]">
                          {address}
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                          Job ID: {inv.jobId}
                        </div>
                      </td>

                      <td className="px-3 py-3 align-top text-[var(--color-text)]/85">
                        {inv.customer?.name || inv.customer?.email || "—"}
                      </td>

                      <td className="px-3 py-3 align-top text-[var(--color-text)]/80">
                        {dateStr || "—"}
                      </td>

                      <td className="px-3 py-3 align-top">
                        <StatusPill status={inv.status} />
                      </td>

                      <td className="px-3 py-3 align-top text-right font-semibold text-[var(--color-text)]">
                        {money(inv.money?.totalCents)}
                      </td>

                      <td className="px-3 py-3 align-top text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedInvoice(inv)}
                            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] font-semibold text-[var(--color-text)]/90 hover:bg-black/30"
                          >
                            View
                          </button>

                          {inv.status !== "paid" && (
                            <button
                              type="button"
                              onClick={() => markInvoicePaid(inv)}
                              disabled={markingPaid}
                              className="rounded-xl bg-emerald-500/90 px-3 py-2 text-[11px] font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
                            >
                              {markingPaid ? "Updating…" : "Mark paid"}
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}

                <tr aria-hidden="true">
                  <td colSpan={7} className="h-14" />
                </tr>
              </tbody>
            </table>

            {/* Sticky pagination footer */}
            <div className="sticky bottom-0 z-30 flex items-center justify-between gap-3 border-t border-white/10 bg-[var(--color-surface)]/70 px-3 py-2 backdrop-blur">
              <div className="text-xs text-[var(--color-muted)]">
                {filteredInvoices.length === 0 ? (
                  "0 results"
                ) : (
                  <>
                    Showing{" "}
                    <span className="font-semibold text-[var(--color-text)]">
                      {(invoicesPage - 1) * INVOICES_PER_PAGE + 1}
                    </span>
                    {"–"}
                    <span className="font-semibold text-[var(--color-text)]">
                      {Math.min(
                        invoicesPage * INVOICES_PER_PAGE,
                        filteredInvoices.length
                      )}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-[var(--color-text)]">
                      {filteredInvoices.length}
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={invoicesPage <= 1}
                  onClick={() =>
                    setInvoicesPage((p: number) => Math.max(1, p - 1))
                  }
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] font-semibold text-[var(--color-text)]/90 hover:bg-black/30 disabled:opacity-50"
                >
                  Prev
                </button>

                <div className="text-[11px] text-[var(--color-muted)]">
                  Page{" "}
                  <span className="font-semibold text-[var(--color-text)]">
                    {invoicesPage}
                  </span>{" "}
                  / {invoicesTotalPages}
                </div>

                <button
                  type="button"
                  disabled={invoicesPage >= invoicesTotalPages}
                  onClick={() =>
                    setInvoicesPage((p: number) =>
                      Math.min(invoicesTotalPages, p + 1)
                    )
                  }
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] font-semibold text-[var(--color-text)]/90 hover:bg-black/30 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </motion.section>
      </div>

      {/* Create invoice modal */}
      <AnimatePresence>
        {openForm && (
          <NewInvoiceModal
            orgId={orgId}
            jobs={jobs}
            onClose={() => setOpenForm(false)}
            onCreated={() => {
              // optional hook
            }}
            pushToast={pushToast}
          />
        )}
      </AnimatePresence>

      {/* Invoice preview modal */}
      <AnimatePresence>
        {selectedInvoice && (
          <InvoicePreviewModal
            invoice={selectedInvoice}
            job={selectedInvoiceJob}
            onClose={() => setSelectedInvoice(null)}
            onMarkPaid={async () => {
              await markInvoicePaid(selectedInvoice);
            }}
            saving={markingPaid}
          />
        )}
      </AnimatePresence>

      {/* Global Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed right-4 top-20 z-50"
          >
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[var(--color-surface)]/80 px-4 py-3 text-sm shadow-2xl backdrop-blur">
              <div className="mt-0.5">
                {toast.status === "loading" ? (
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--color-muted)]" />
                ) : toast.status === "success" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-300" />
                )}
              </div>

              <div className="flex-1">
                <div
                  className={
                    "font-semibold " +
                    (toast.status === "success"
                      ? "text-emerald-200"
                      : toast.status === "error"
                      ? "text-red-200"
                      : "text-[var(--color-text)]")
                  }
                >
                  {toast.title}
                </div>
                <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                  {toast.message}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setToast(null)}
                className="ml-2 rounded-full p-1 text-[var(--color-muted)] hover:bg-white/10 hover:text-[var(--color-text)]"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
