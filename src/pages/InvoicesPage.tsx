// src/pages/InvoicesPage.tsx
// Upgraded to ROOFZEUS dark command-center theme + Framer Motion + CountUp.
// Preserves all existing helper functions, listeners, Firestore mappings, and modal logic.

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
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
  Plus,
  Printer,
  Search,
  Filter,
} from "lucide-react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import CountUp from "react-countup";

import { useOrg } from "../contexts/OrgContext";
import { db } from "../firebase/firebaseConfig";
import type {
  Address,
  InvoiceDoc,
  Job,
  InvoiceLine,
  InvoiceStatus,
  Organization,
} from "../types/types";
import { jobConverter } from "../types/types";

import fallbackLogo from "../assets/rogers-roofing.webp";

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
function orgCollection(orgId: string, sub: string) {
  return collection(db, "organizations", orgId, sub);
}
function orgDoc(orgId: string, sub: string, id: string) {
  return doc(db, "organizations", orgId, sub, id);
}

function formatOrgAddress(address: Address | null | undefined): string {
  if (!address) return "";

  const removeCountry = (value: string) =>
    value
      .replace(/,\s*(US|USA|United States|United States of America)\s*$/i, "")
      .trim();

  const fullLine = address.fullLine?.trim();
  if (fullLine) return removeCountry(fullLine);

  const line1 = address.line1 || address.street || "";

  const cityStateZip = [
    address.city,
    [address.state, address.zip || address.postalCode]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return removeCountry([line1, cityStateZip].filter(Boolean).join(" • "));
}

function invoiceStatusClasses(status: InvoiceDoc["status"]) {
  switch (status) {
    case "paid":
      return "border-[rgb(var(--pill-success-rgb)/0.32)] bg-[rgb(var(--pill-success-rgb)/0.12)] text-[rgb(var(--pill-success-rgb))]";
    case "sent":
      return "border-[rgb(var(--pill-warning-rgb)/0.34)] bg-[rgb(var(--pill-warning-rgb)/0.12)] text-[rgb(var(--pill-warning-rgb))]";
    case "draft":
      return "border-[rgb(var(--color-border-rgb)/0.24)] bg-[rgb(var(--color-surface-rgb)/0.55)] text-[rgb(var(--color-text-rgb)/0.72)]";
    case "void":
    default:
      return "border-[rgb(var(--pill-danger-rgb)/0.34)] bg-[rgb(var(--pill-danger-rgb)/0.12)] text-[rgb(var(--pill-danger-rgb))]";
  }
}

// Generate a human friendly invoice number like INV-2025-000123
async function generateInvoiceNumber(orgId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  try {
    const q = query(
      orgCollection(orgId, "invoices"),
      orderBy("number", "desc"),
      orderBy("createdAt", "desc")
    );

    const snap = await getDocs(q);

    let maxSeq = 0;
    snap.forEach((d) => {
      const num = (d.data() as InvoiceDoc).number;
      if (!num?.startsWith(prefix)) return;

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
  /**
   * Determine who the invoice should be billed to. When set to "job", the
   * customer fields are automatically populated from the job's billing
   * information (homeowner or billingContact) and disabled for editing. When
   * set to "custom", the user can freely edit the customer fields for this
   * invoice. This improves UX by encouraging sensible invoices that match
   * industry practice — residential jobs bill the homeowner while
   * commercial/new‑construction jobs bill a builder or other third‑party.
   */
  const [billTo, setBillTo] = useState<"job" | "custom">("job");
  const [description, setDescription] = useState<string>("");
  const [extras, setExtras] = useState<{ label: string; amount: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingMode, setSavingMode] = useState<InvoiceStatus | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [billMaterialsSeparately, setBillMaterialsSeparately] = useState(false);
  const [materialsMarkupPct, setMaterialsMarkupPct] = useState<string>("0");

  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === jobId) ?? null,
    [jobs, jobId]
  );

  function getInvoiceCustomerFromJob(job: Job | null) {
    if (!job) return { name: "", email: "", phone: "" };

    const recipient = job.billingRecipient ?? "homeowner";

    if (recipient === "homeowner") {
      return {
        name: job.homeowner?.name ?? "",
        email: job.homeowner?.email ?? "",
        phone: job.homeowner?.phone ?? "",
      };
    }

    const contact = job.billingContact;

    return {
      name: contact?.companyName || contact?.name || "",
      email: contact?.email ?? "",
      phone: contact?.phone ?? "",
    };
  }

  useEffect(() => {
    const customer = getInvoiceCustomerFromJob(selectedJob);

    setCustomerName(customer.name);
    setCustomerEmail(customer.email);
    setCustomerPhone(customer.phone);
  }, [
    selectedJob?.id,
    selectedJob?.billingRecipient,
    selectedJob?.billingContact,
    selectedJob?.homeowner,
  ]);

  /**
   * Compute the default billing contact for the selected job. If a job
   * explicitly defines a billingRecipient of "builder" or "custom" and
   * provides a billingContact, prefer that. Otherwise fall back to the
   * homeowner contact when present. If no contact information exists the
   * defaults will be empty strings.
   */
  const defaultBilling = useMemo(() => {
    if (!selectedJob) {
      return {
        source: "none" as const,
        sourceLabel: "No billing contact saved",
        name: "",
        email: "",
        phone: "",
      };
    }

    const billingRecipient = (selectedJob as any).billingRecipient as
      | "homeowner"
      | "builder"
      | "custom"
      | undefined;

    const billingContact = (selectedJob as any).billingContact as
      | { name?: string; email?: string; phone?: string }
      | undefined;

    const homeowner = (selectedJob as any).homeowner as
      | { name?: string; email?: string; phone?: string }
      | undefined;

    if (billingRecipient === "builder" && billingContact) {
      return {
        source: "builder" as const,
        sourceLabel: "Builder / GC",
        name: billingContact.name ?? "",
        email: billingContact.email ?? "",
        phone: billingContact.phone ?? "",
      };
    }

    if (billingRecipient === "custom" && billingContact) {
      return {
        source: "custom" as const,
        sourceLabel: "Saved billing contact",
        name: billingContact.name ?? "",
        email: billingContact.email ?? "",
        phone: billingContact.phone ?? "",
      };
    }

    if (homeowner) {
      return {
        source: "homeowner" as const,
        sourceLabel: "Homeowner",
        name: homeowner.name ?? "",
        email: homeowner.email ?? "",
        phone: homeowner.phone ?? "",
      };
    }

    return {
      source: "none" as const,
      sourceLabel: "No billing contact saved",
      name: "",
      email: "",
      phone: "",
    };
  }, [selectedJob]);

  const defaultContactLabel = useMemo(() => {
    const contactValue =
      defaultBilling.name || defaultBilling.email || defaultBilling.phone;

    return contactValue
      ? `${defaultBilling.sourceLabel} (${contactValue})`
      : defaultBilling.sourceLabel;
  }, [defaultBilling]);

  // Whenever the selected job or billing mode changes, populate the
  // customer fields when using job defaults. If the user switches to
  // custom mode the current values are preserved to avoid surprise resets.
  useEffect(() => {
    if (billTo === "job") {
      setCustomerName(defaultBilling.name);
      setCustomerEmail(defaultBilling.email);
      setCustomerPhone(defaultBilling.phone);
    }
  }, [defaultBilling, billTo]);

  function computeJobMaterialCostCents(job: Job | null): number {
    if (!job) return 0;
    const mats = job.expenses?.materials ?? [];
    return mats.reduce((sum, m: any) => sum + (m?.amountCents ?? 0), 0);
  }

  // Derived billable amounts (what the customer is invoiced for)
  // IMPORTANT: invoices must reflect REVENUE (contract price), not internal costs like crew payouts/material expenses.
  function computeJobRevenueCents(job: Job | null): number {
    if (!job) return 0;

    // Preferred: explicit earnings total (your canonical "what we made on this job")
    const earnings = job.earnings?.totalEarningsCents;
    if (
      typeof earnings === "number" &&
      Number.isFinite(earnings) &&
      earnings > 0
    ) {
      return Math.round(earnings);
    }

    // Fallback: pricing model (sqft * ratePerSqFt) + fee
    const sqft = job.pricing?.sqft ?? 0;
    const rate = job.pricing?.ratePerSqFt ?? 0; // dollars per sqft
    const feeCents = job.pricing?.feeCents ?? 0;

    const base = Math.round(Number(sqft) * Number(rate) * 100);
    const total = base + Math.round(Number(feeCents) || 0);

    return Number.isFinite(total) && total > 0 ? total : 0;
  }

  // Billable "base contract" amount goes into laborCents (keeps your existing InvoiceMoney schema intact)
  const laborCents = computeJobRevenueCents(selectedJob);

  // Do NOT auto-bill materials from internal expense tracking.
  // If you want to bill additional items, use Extras (change orders, decking repair, upgrades, etc.)
  const baseMaterialsCents = computeJobMaterialCostCents(selectedJob);

  const materialsCents = useMemo(() => {
    if (!billMaterialsSeparately) return 0;

    const pct = Number(materialsMarkupPct);
    const markupMultiplier =
      Number.isFinite(pct) && pct > 0 ? 1 + pct / 100 : 1;

    return Math.round(baseMaterialsCents * markupMultiplier);
  }, [billMaterialsSeparately, materialsMarkupPct, baseMaterialsCents]);

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
        label: "Labor Cost",
        amountCents: laborCents,
      });
    }
    if (materialsCents > 0) {
      lines.push({
        id: "materials",
        label: "Material Cost",
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

    try {
      const number = await generateInvoiceNumber(orgId);
      const docRef = doc(orgCollection(orgId, "invoices"));

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
          // Email is sent server-side by the Firestore trigger (onInvoiceCreated).
          // Do not call sendInvoiceEmail here or you'll get duplicates.
          pushToast({
            status: "success",
            title: "Invoice sent",
            message: "Invoice created. The email will be sent automatically.",
          });
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const content = (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/60 p-3 sm:items-center">
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
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--color-border)]/70 bg-[var(--color-surface)] shadow-2xl
           max-h-[calc(100vh-2rem)] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Create invoice"
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
        <div className="px-6 py-5 overflow-y-auto">
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

            {/* Billing selection */}
            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                Bill to
              </label>
              <select
                value={billTo}
                onChange={(e) => setBillTo(e.target.value as "job" | "custom")}
                disabled={saving}
                className="mt-1 w-full rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent-gold)]/40 disabled:opacity-60"
              >
                <option value="job">{`Use saved recipient: ${defaultContactLabel}`}</option>
                <option value="custom">
                  Enter a one-time custom recipient
                </option>
              </select>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">
                Residential jobs usually bill the homeowner. Builder, GC,
                insurance, or third-party invoices should be saved as the job
                billing contact from the job detail page.
              </p>
            </div>

            {/* Customer fields populated from job or custom */}
            <div>
              <label className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                Customer name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                disabled={saving || billTo === "job"}
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
                disabled={saving || billTo === "job"}
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
                disabled={saving || billTo === "job"}
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
            <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)]/70 bg-[var(--color-card)] px-3 py-3">
              <label className="flex items-center gap-2 text-xs text-[var(--color-text)]/85">
                <input
                  type="checkbox"
                  checked={billMaterialsSeparately}
                  onChange={(e) => setBillMaterialsSeparately(e.target.checked)}
                  disabled={saving}
                  className="h-4 w-4 accent-[var(--color-accent-gold)]"
                />
                Bill materials separately (reimbursable)
              </label>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--color-muted)]">
                  Markup %
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={materialsMarkupPct}
                  onChange={(e) => setMaterialsMarkupPct(e.target.value)}
                  disabled={saving || !billMaterialsSeparately}
                  className="w-20 rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent-gold)]/40 disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <div className="rounded-xl border border-[var(--color-border)]/70 bg-[var(--color-card)] px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                  Labor Cost
                </div>
                <div className="mt-1 text-lg font-semibold text-[var(--color-text)]">
                  {money(laborCents)}
                </div>
              </div>
            </div>

            <div>
              <div className="rounded-xl border border-[var(--color-border)]/70 bg-[var(--color-card)] px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                  Material Cost
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

              <div
                className={
                  extras.length > 3
                    ? "mt-2 max-h-56 overflow-y-auto pr-1"
                    : "mt-2"
                }
              >
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
        <div
          className="flex flex-col-reverse gap-2 border-t border-[var(--color-border)]/60 px-6 py-4
                sm:flex-row sm:items-center sm:justify-between
                bg-[var(--color-surface)]/85 backdrop-blur"
        >
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
 * Uses organization branding dynamically and supports dark/light ROOFZEUS theme tokens.
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
  const { orgId } = useOrg();
  const [org, setOrg] = useState<Organization | null>(null);

  useEffect(() => {
    if (!orgId) {
      setOrg(null);
      return;
    }

    const ref = doc(db, "organizations", orgId);

    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setOrg(null);
        return;
      }

      setOrg({
        id: snap.id,
        ...(snap.data() as Omit<Organization, "id">),
      });
    });

    return () => unsub();
  }, [orgId]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  if (typeof document === "undefined") return null;

  function displayLineLabel(label: string) {
    if (label === "Contract total") return "Labor Cost";
    if (label === "Reimbursable materials") return "Material Cost";
    return label;
  }

  const orgDisplayName = useMemo(() => {
    return (
      org?.legalName?.trim() || org?.name?.trim() || "Your Roofing Company"
    );
  }, [org]);

  const orgAddress = useMemo(() => {
    return formatOrgAddress(org?.address ?? null);
  }, [org]);

  const orgLogo = org?.logoUrl?.trim() || fallbackLogo;

  const jobAddr = useMemo(() => {
    if (!job) return { display: "", city: "", state: "", zip: "" };

    const a = job.address;

    if (typeof a === "string") {
      return { display: a, city: "", state: "", zip: "" };
    }

    return {
      display: a.fullLine ?? a.line1 ?? a.street ?? "",
      city: a.city ?? "",
      state: a.state ?? "",
      zip: a.zip ?? a.postalCode ?? "",
    };
  }, [job]);

  const invoiceAddress = useMemo(() => {
    const snapshot = invoice.addressSnapshot;

    const display =
      snapshot?.fullLine || snapshot?.line1 || jobAddr.display || "—";

    const city = snapshot?.city || jobAddr.city;
    const state = snapshot?.state || jobAddr.state;
    const zip = snapshot?.zip || jobAddr.zip;

    const cityStateZip = [city, [state, zip].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ");

    return { display, cityStateZip };
  }, [invoice.addressSnapshot, jobAddr]);

  const creationDate = useMemo(() => {
    let dt: Date | null = null;
    const anyDate = invoice.createdAt as any;

    if (anyDate?.toDate) dt = anyDate.toDate();
    else if (anyDate instanceof Date) dt = anyDate;

    if (!dt) return "—";

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
      className={[
        "paystub-print fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm",
        "print:static print:z-auto print:m-0 print:block print:bg-transparent print:p-0 print:backdrop-blur-0",
      ].join(" ")}
    >
      {/* Backdrop click target */}
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 cursor-default print:hidden"
        aria-label="Close invoice preview"
      />

      {/* Viewport-safe scroll layer */}
      <div
        className={[
          "relative z-10 h-[100dvh] overflow-y-auto modal-scroll",
          "px-3 py-3 sm:px-4 sm:py-5",
          "print:h-auto print:overflow-visible print:p-0",
        ].join(" ")}
      >
        <div className="mx-auto flex min-h-full w-full max-w-3xl items-start justify-center print:block print:max-w-none">
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.99 }}
            transition={{ duration: 0.2 }}
            className={[
              "paystub-print-inner relative flex w-full flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text)] shadow-[0_24px_90px_rgba(0,0,0,0.55)]",
              "max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)]",
              "print:m-0 print:block print:h-auto print:max-h-none print:w-full print:max-w-none print:overflow-visible print:rounded-none print:border-0 print:bg-white print:text-black print:shadow-none",
            ].join(" ")}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative shrink-0 border-b border-[var(--color-border)] px-5 py-5 print:border-gray-200">
              <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[var(--color-accent-gold)]/10 blur-3xl print:hidden" />
              <div className="pointer-events-none absolute -bottom-24 left-10 h-52 w-52 rounded-full bg-[rgb(var(--pill-success-rgb)/0.08)] blur-3xl print:hidden" />

              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-4">
                    <img
                      src={orgLogo}
                      className="h-16 w-16 rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-white object-contain p-1 shadow-sm print:border-gray-200"
                      alt={`${orgDisplayName} logo`}
                    />

                    <div className="min-w-0">
                      <div className="inline-flex items-center rounded-full border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-gold)] print:border-gray-200 print:bg-gray-50 print:text-gray-600">
                        {invoice.kind === "receipt" ? "Receipt" : "Invoice"}
                      </div>

                      <h2 className="mt-2 text-xl font-semibold leading-tight text-[var(--color-text)] print:text-black">
                        {orgDisplayName}
                      </h2>

                      {orgAddress && (
                        <p className="mt-1 text-xs text-[rgb(var(--color-text-rgb)/0.58)] print:text-gray-600">
                          {orgAddress}
                        </p>
                      )}

                      {(org?.phone || org?.email) && (
                        <p className="mt-1 text-xs text-[rgb(var(--color-text-rgb)/0.52)] print:text-gray-600">
                          {[org.phone, org.email].filter(Boolean).join(" • ")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-left sm:text-right">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-[rgb(var(--color-border-rgb)/0.24)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-2 text-[11px] font-semibold text-[rgb(var(--color-text-rgb)/0.78)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.75)] print:hidden"
                  >
                    Close
                  </button>

                  <div className="mt-5 space-y-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.50)] print:text-gray-500">
                        Invoice #
                      </p>
                      <p className="text-base font-semibold text-[var(--color-text)] print:text-black">
                        {invoice.number}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.50)] print:text-gray-500">
                        Date
                      </p>
                      <p className="text-base font-semibold text-[var(--color-text)] print:text-black">
                        {creationDate}
                      </p>
                    </div>

                    <span
                      className={[
                        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold capitalize",
                        "print:border-gray-200 print:bg-gray-50 print:text-gray-700",
                        invoiceStatusClasses(invoice.status),
                      ].join(" ")}
                    >
                      {invoice.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="modal-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5 print:flex-none print:overflow-visible print:px-0 print:py-4">
              <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
                <div className="rounded-2xl border border-[rgb(var(--color-border-rgb)/0.16)] bg-[rgb(var(--color-surface-rgb)/0.35)] p-4 print:rounded-none print:border-gray-200 print:bg-white">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.52)] print:text-gray-500">
                    Bill To
                  </h3>

                  {invoice.customer ? (
                    <div className="mt-3 space-y-1 text-sm text-[rgb(var(--color-text-rgb)/0.78)] print:text-gray-800">
                      {invoice.customer.name && (
                        <p className="font-semibold text-[var(--color-text)] print:text-black">
                          {invoice.customer.name}
                        </p>
                      )}

                      {invoice.customer.email && (
                        <p>{invoice.customer.email}</p>
                      )}
                      {invoice.customer.phone && (
                        <p>{invoice.customer.phone}</p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-[rgb(var(--color-text-rgb)/0.55)] print:text-gray-500">
                      No customer information saved.
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-[rgb(var(--color-border-rgb)/0.16)] bg-[rgb(var(--color-surface-rgb)/0.35)] p-4 print:rounded-none print:border-gray-200 print:bg-white">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.52)] print:text-gray-500">
                    Job Address
                  </h3>

                  <div className="mt-3 text-sm text-[rgb(var(--color-text-rgb)/0.78)] print:text-gray-800">
                    <p className="font-medium text-[var(--color-text)] print:text-black">
                      {invoiceAddress.display}
                    </p>

                    {invoiceAddress.cityStateZip && (
                      <p className="mt-1">{invoiceAddress.cityStateZip}</p>
                    )}
                  </div>
                </div>
              </div>

              {invoice.description && (
                <div className="mt-4 rounded-2xl border border-[rgb(var(--color-border-rgb)/0.16)] bg-[rgb(var(--color-surface-rgb)/0.35)] p-4 print:rounded-none print:border-gray-200 print:bg-white">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.52)] print:text-gray-500">
                    Description
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[rgb(var(--color-text-rgb)/0.78)] print:text-gray-800">
                    {invoice.description}
                  </p>
                </div>
              )}

              {/* Line items */}
              <div className="mt-5 overflow-hidden rounded-2xl border border-[rgb(var(--color-border-rgb)/0.18)] print:rounded-none print:border-gray-200">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead className="bg-[rgb(var(--color-surface-rgb)/0.45)] text-[11px] uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.54)] print:bg-gray-50 print:text-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left">Item</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[rgb(var(--color-border-rgb)/0.12)] print:divide-gray-200">
                    {invoice.lines.map((ln) => (
                      <tr key={ln.id}>
                        <td className="px-4 py-3 align-top text-sm text-[rgb(var(--color-text-rgb)/0.82)] print:text-gray-800">
                          {displayLineLabel(ln.label)}
                        </td>
                        <td className="px-4 py-3 align-top text-right text-sm font-semibold text-[var(--color-text)] print:text-black">
                          {money(ln.amountCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="mt-5 flex justify-end">
                <div className="w-full max-w-sm rounded-2xl border border-[rgb(var(--color-border-rgb)/0.16)] bg-[rgb(var(--color-surface-rgb)/0.30)] p-4 text-sm print:rounded-none print:border-gray-200 print:bg-white">
                  <div className="flex justify-between gap-6">
                    <span className="text-[rgb(var(--color-text-rgb)/0.58)] print:text-gray-600">
                      Subtotal
                    </span>
                    <span className="font-medium text-[var(--color-text)] print:text-black">
                      {money(subtotal)}
                    </span>
                  </div>

                  <div className="mt-2 flex justify-between gap-6">
                    <span className="text-[rgb(var(--color-text-rgb)/0.58)] print:text-gray-600">
                      Tax
                    </span>
                    <span className="font-medium text-[var(--color-text)] print:text-black">
                      {money(tax)}
                    </span>
                  </div>

                  <div className="mt-3 flex justify-between gap-6 border-t border-[rgb(var(--color-border-rgb)/0.18)] pt-3 text-base print:border-gray-200">
                    <span className="font-semibold text-[var(--color-text)] print:text-black">
                      Total
                    </span>
                    <span className="font-semibold text-[var(--color-accent-gold)] print:text-black">
                      {money(total)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-8 border-t border-[rgb(var(--color-border-rgb)/0.18)] pt-4 text-xs text-[rgb(var(--color-text-rgb)/0.52)] print:border-gray-200 print:text-gray-500">
                Thank you for your business. If you have questions about this
                invoice, please contact {orgDisplayName}.
              </div>
            </div>

            {/* Fixed modal footer actions */}
            <div className="shrink-0 border-t border-[rgb(var(--color-border-rgb)/0.14)] bg-[var(--color-card)]/95 px-5 py-3 backdrop-blur print:hidden">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-[11px] text-[rgb(var(--color-text-rgb)/0.52)]">
                  Invoice total:{" "}
                  <span className="font-semibold text-[var(--color-accent-gold)]">
                    {money(total)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--color-border-rgb)/0.24)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-2 text-xs font-semibold text-[rgb(var(--color-text-rgb)/0.82)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.75)] hover:shadow-md"
                  >
                    <Printer className="h-4 w-4" />
                    Print / Save PDF
                  </button>

                  {invoice.status !== "paid" && (
                    <button
                      type="button"
                      onClick={onMarkPaid}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--pill-success-rgb)/0.30)] bg-[rgb(var(--pill-success-rgb)/0.12)] px-4 py-2 text-xs font-semibold text-[rgb(var(--pill-success-rgb))] transition hover:bg-[rgb(var(--pill-success-rgb)/0.18)] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {saving ? "Marking…" : "Mark as paid"}
                    </button>
                  )}

                  {invoice.status === "paid" && (
                    <span className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--pill-success-rgb)/0.30)] bg-[rgb(var(--pill-success-rgb)/0.12)] px-3 py-2 text-xs font-semibold text-[rgb(var(--pill-success-rgb))]">
                      <CheckCircle2 className="h-4 w-4" />
                      Paid
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
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
      orgCollection(orgId, "invoices"),
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
      orgCollection(orgId, "jobs").withConverter(jobConverter),
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
      const ref = orgDoc(orgId, "invoices", inv.id);
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

  function StatusPill({ inv }: { inv: InvoiceDoc }) {
    const status = inv.status;

    const base =
      "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold capitalize";

    const hasEmailFailure =
      status === "sent" && !!inv.lastEmailError && !inv.lastEmailSentAt;

    const inFlight =
      status === "sent" && !!inv.emailSendInFlightAt && !inv.lastEmailSentAt;

    if (hasEmailFailure) {
      return (
        <span
          className={[
            base,
            "border-[rgb(var(--pill-danger-rgb)/0.25)]",
            "bg-[rgb(var(--pill-danger-rgb)/0.12)]",
            "text-[rgb(var(--pill-danger-rgb))]",
          ].join(" ")}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--pill-danger-rgb))]" />
          email failed
        </span>
      );
    }

    if (inFlight) {
      return (
        <span
          className={[
            base,
            "border-[rgb(var(--color-text-rgb)/0.12)]",
            "bg-[rgb(var(--color-text-rgb)/0.06)]",
            "text-[rgb(var(--color-text-rgb)/0.75)]",
          ].join(" ")}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--color-text-rgb)/0.35)]" />
          sending…
        </span>
      );
    }

    if (status === "paid") {
      return (
        <span
          className={[
            base,
            "border-[rgb(var(--pill-success-rgb)/0.25)]",
            "bg-[rgb(var(--pill-success-rgb)/0.12)]",
            "text-[rgb(var(--pill-success-rgb))]",
          ].join(" ")}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--pill-success-rgb))]" />
          paid
        </span>
      );
    }

    if (status === "sent") {
      return (
        <span
          className={[
            base,
            "border-[rgb(var(--color-primary-rgb)/0.25)]",
            "bg-[rgb(var(--color-primary-rgb)/0.12)]",
            "text-[rgb(var(--color-text-rgb)/0.9)]",
          ].join(" ")}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--color-primary-rgb))]" />
          sent
        </span>
      );
    }

    if (status === "draft") {
      return (
        <span
          className={[
            base,
            "border-[rgb(var(--color-text-rgb)/0.12)]",
            "bg-[rgb(var(--color-text-rgb)/0.06)]",
            "text-[rgb(var(--color-text-rgb)/0.75)]",
          ].join(" ")}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--color-text-rgb)/0.35)]" />
          draft
        </span>
      );
    }

    return (
      <span
        className={[
          base,
          "border-[rgb(var(--pill-danger-rgb)/0.25)]",
          "bg-[rgb(var(--pill-danger-rgb)/0.12)]",
          "text-[rgb(var(--pill-danger-rgb))]",
        ].join(" ")}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--pill-danger-rgb))]" />
        {status}
      </span>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto w-[min(1180px,94vw)] space-y-6 py-8">
        {/* Page Header */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="space-y-5"
        >
          <motion.header
            variants={fadeUp}
            className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-5 shadow-md sm:px-6"
          >
            <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[var(--color-accent-gold)]/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-28 left-16 h-52 w-52 rounded-full bg-[rgb(var(--pill-success-rgb)/0.08)] blur-3xl" />

            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--color-accent-gold)]/25 bg-[var(--color-accent-gold)]/10 text-[var(--color-accent-gold)]">
                    <FileText className="h-5 w-5" />
                  </div>

                  <div className="min-w-0">
                    <h1 className="text-2xl font-semibold tracking-wide text-[var(--color-text)]">
                      Invoices
                    </h1>
                    <p className="mt-1 text-sm text-[rgb(var(--color-text-rgb)/0.62)]">
                      Create, send, print, and track customer invoices for your
                      jobs.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <span className="inline-flex items-center rounded-full border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-1 text-[11px] text-[rgb(var(--color-text-rgb)/0.65)]">
                  {filteredInvoices.length} visible
                </span>

                <span className="inline-flex items-center rounded-full border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-1 text-[11px] text-[rgb(var(--color-text-rgb)/0.65)]">
                  {totalInvoices} total
                </span>

                <button
                  type="button"
                  onClick={() => setOpenForm(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent-gold)] px-4 py-2 text-xs font-semibold text-[var(--btn-text)] shadow-sm transition hover:bg-[var(--btn-hover-bg)] hover:shadow-md"
                >
                  <Plus className="h-4 w-4" />
                  New invoice
                </button>
              </div>
            </div>
          </motion.header>

          {/* Overview */}
          <motion.section
            variants={fadeUp}
            className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-md"
          >
            <div className="border-b border-[var(--color-border)] px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--color-text)]">
                    Overview
                  </h2>
                  <p className="mt-1 text-xs text-[var(--color-accent-gold)]/70">
                    Live invoice totals across your organization.
                  </p>
                </div>

                <div className="inline-flex w-fit items-center rounded-full border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-1 text-[11px] text-[rgb(var(--color-text-rgb)/0.62)]">
                  Status:{" "}
                  <span className="ml-1 font-semibold capitalize text-[rgb(var(--color-text-rgb)/0.9)]">
                    {statusFilter === "all" ? "All" : statusFilter}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:p-5">
              <div className="rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.45)] p-4 transition hover:bg-[rgb(var(--color-surface-rgb)/0.65)] hover:shadow-md">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.52)]">
                  Total invoices
                </div>
                <div className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
                  <CountUp end={totalInvoices} duration={0.7} />
                </div>
              </div>

              <div className="rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.45)] p-4 transition hover:bg-[rgb(var(--color-surface-rgb)/0.65)] hover:shadow-md">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.52)]">
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

              <div className="rounded-xl border border-[rgb(var(--pill-warning-rgb)/0.25)] bg-[rgb(var(--pill-warning-rgb)/0.10)] p-4 transition hover:bg-[rgb(var(--pill-warning-rgb)/0.14)] hover:shadow-md">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.52)]">
                  Outstanding
                </div>
                <div className="mt-2 text-2xl font-semibold text-[rgb(var(--pill-warning-rgb))]">
                  <CountUp
                    end={outstandingAmount / 100}
                    decimals={2}
                    prefix="$"
                    duration={0.85}
                    separator=","
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[rgb(var(--pill-success-rgb)/0.25)] bg-[rgb(var(--pill-success-rgb)/0.10)] p-4 transition hover:bg-[rgb(var(--pill-success-rgb)/0.14)] hover:shadow-md">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.52)]">
                  Paid
                </div>
                <div className="mt-2 text-2xl font-semibold text-[rgb(var(--pill-success-rgb))]">
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
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--color-text-rgb)/0.45)]" />
                <input
                  type="text"
                  placeholder="Search invoices by number, customer, or email…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full min-w-[280px] rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] py-2 pl-9 pr-3 text-sm text-[var(--color-text)] outline-none placeholder:text-[rgb(var(--color-text-rgb)/0.42)] transition focus:ring-2 focus:ring-[var(--color-accent-gold)]/35"
                />
              </div>

              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--color-text-rgb)/0.45)]" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] py-2 pl-9 pr-8 text-sm text-[var(--color-text)] outline-none transition focus:ring-2 focus:ring-[var(--color-accent-gold)]/35"
                >
                  <option value="all">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                  <option value="void">Void</option>
                </select>
              </div>
            </div>

            <div className="hidden text-xs text-[rgb(var(--color-text-rgb)/0.55)] md:block">
              Click{" "}
              <span className="font-semibold text-[rgb(var(--color-text-rgb)/0.85)]">
                View
              </span>{" "}
              to print or mark an invoice paid.
            </div>
          </motion.section>
        </motion.div>

        {/* Invoices Table */}
        <motion.section
          initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.35, ease }}
          className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-md"
        >
          <div className="border-b border-[var(--color-border)] px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)]">
                    <Printer className="h-4 w-4 text-[var(--color-accent-gold)]" />
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-[var(--color-text)]">
                      Invoice queue
                    </h3>
                    <p className="mt-1 text-xs text-[rgb(var(--color-text-rgb)/0.55)]">
                      Most recent invoices first.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-1 text-[11px] text-[rgb(var(--color-text-rgb)/0.62)]">
                  Page{" "}
                  <span className="mx-1 font-semibold text-[rgb(var(--color-text-rgb)/0.9)]">
                    {invoicesPage}
                  </span>
                  / {invoicesTotalPages}
                </span>

                <span className="inline-flex items-center rounded-full border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-1 text-[11px] text-[rgb(var(--color-text-rgb)/0.62)]">
                  Showing {pagedInvoices.length}
                </span>
              </div>
            </div>
          </div>

          <div className="relative overflow-auto section-scroll-invoices">
            <table className="w-full min-w-[980px] table-fixed text-sm">
              <colgroup>
                <col className="w-[17%]" />
                <col className="w-[28%]" />
                <col className="w-[18%]" />
                <col className="w-[11%]" />
                <col className="w-[11%]" />
                <col className="w-[9%]" />
                <col className="w-[14%]" />
              </colgroup>

              <thead className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-card)]/95 text-[11px] uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.55)] backdrop-blur">
                <tr>
                  <th className="px-4 py-3 text-left">Number</th>
                  <th className="px-4 py-3 text-left">Job</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[rgb(var(--color-border-rgb)/0.12)]">
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-[rgb(var(--color-text-rgb)/0.55)]"
                    >
                      No invoices found.
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
                      transition={{ duration: 0.22, ease }}
                      className="group transition hover:bg-[rgb(var(--color-surface-rgb)/0.38)]"
                    >
                      <td className="px-4 py-4 align-top">
                        <div className="font-semibold text-[var(--color-text)]">
                          {inv.number}
                        </div>
                        <div className="mt-1 text-[11px] text-[rgb(var(--color-text-rgb)/0.45)]">
                          Invoice
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="truncate font-semibold text-[var(--color-text)]">
                          {address || "Unknown job"}
                        </div>
                        <div className="mt-1 truncate text-[11px] text-[rgb(var(--color-text-rgb)/0.48)]">
                          Job ID: {inv.jobId}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="truncate font-medium text-[rgb(var(--color-text-rgb)/0.86)]">
                          {inv.customer?.name || "—"}
                        </div>
                        {inv.customer?.email && (
                          <div className="mt-1 truncate text-[11px] text-[rgb(var(--color-text-rgb)/0.48)]">
                            {inv.customer.email}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-4 align-top text-[rgb(var(--color-text-rgb)/0.72)]">
                        {dateStr || "—"}
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-col items-start gap-1">
                          <StatusPill inv={inv} />
                          {inv.status === "sent" &&
                            inv.lastEmailError &&
                            !inv.lastEmailSentAt && (
                              <span
                                className="cursor-help text-[11px] text-[rgb(var(--pill-danger-rgb)/0.85)]"
                                title={inv.lastEmailError}
                              >
                                Email issue
                              </span>
                            )}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top text-right">
                        <div className="font-semibold text-[var(--color-accent-gold)]">
                          {money(inv.money?.totalCents)}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedInvoice(inv)}
                            className="inline-flex items-center justify-center rounded-xl border border-[rgb(var(--color-border-rgb)/0.25)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-2 text-[11px] font-semibold text-[rgb(var(--color-text-rgb)/0.9)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.78)] hover:shadow-md"
                          >
                            View
                          </button>

                          {inv.status !== "paid" && (
                            <button
                              type="button"
                              onClick={() => markInvoicePaid(inv)}
                              disabled={markingPaid}
                              className="inline-flex items-center justify-center rounded-xl border border-[rgb(var(--pill-success-rgb)/0.30)] bg-[rgb(var(--pill-success-rgb)/0.12)] px-3 py-2 text-[11px] font-semibold text-[rgb(var(--pill-success-rgb))] transition hover:bg-[rgb(var(--pill-success-rgb)/0.18)] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
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
                  <td colSpan={7} className="h-12" />
                </tr>
              </tbody>
            </table>

            {/* Sticky pagination footer */}
            <div className="sticky bottom-0 z-30 flex items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-card)]/95 px-4 py-3 backdrop-blur">
              <div className="text-xs text-[rgb(var(--color-text-rgb)/0.58)]">
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
                  className="rounded-xl border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-surface-rgb)/0.45)] px-3 py-2 text-[11px] font-semibold text-[rgb(var(--color-text-rgb)/0.86)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.70)] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Prev
                </button>

                <div className="rounded-xl border border-[rgb(var(--color-border-rgb)/0.16)] bg-[rgb(var(--color-surface-rgb)/0.35)] px-3 py-2 text-[11px] text-[rgb(var(--color-text-rgb)/0.62)]">
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
                  className="rounded-xl border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-surface-rgb)/0.45)] px-3 py-2 text-[11px] font-semibold text-[rgb(var(--color-text-rgb)/0.86)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.70)] disabled:cursor-not-allowed disabled:opacity-45"
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
