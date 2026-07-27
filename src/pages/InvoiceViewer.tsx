import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { collection, doc, getDoc } from "firebase/firestore";
import {
  ArrowLeft,
  Check,
  Copy,
  FileText,
  Printer,
} from "lucide-react";

import { db } from "../firebase/firebaseConfig";
import type { InvoiceDoc, Org } from "../types/types";
import fallbackLogo from "../assets/rz-modern-blk.svg";

type FsTimestampLike = { toDate: () => Date };

function isFsTimestamp(value: unknown): value is FsTimestampLike {
  return typeof (value as FsTimestampLike)?.toDate === "function";
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  if (isFsTimestamp(value)) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function formatDate(value: unknown) {
  const date = asDate(value);
  if (!date) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function money(cents: number | null | undefined) {
  return ((typeof cents === "number" ? cents : 0) / 100).toLocaleString(
    undefined,
    {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}

function formatOrgAddress(address: Org["address"]) {
  if (!address) return "";
  const line1 = address.line1 || address.street || "";
  const locality = [
    address.city,
    [address.state, address.zip || address.postalCode]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  return [line1, locality].filter(Boolean).join(" · ");
}

function statusClasses(status: InvoiceDoc["status"]) {
  switch (status) {
    case "paid":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "sent":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "void":
      return "border-red-200 bg-red-50 text-red-700";
    case "draft":
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function displayLineLabel(label: string) {
  if (label === "Contract total") return "Roofing work";
  if (label === "Reimbursable materials") return "Materials";
  return label;
}

export default function InvoiceViewer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<InvoiceDoc | null>(null);
  const [organization, setOrganization] = useState<Org | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadInvoice() {
      try {
        if (!id) throw new Error("Invoice ID is missing.");

        const invoiceSnap = await getDoc(doc(collection(db, "invoices"), id));
        if (!invoiceSnap.exists()) throw new Error("Invoice not found.");

        const nextInvoice = {
          id: invoiceSnap.id,
          ...invoiceSnap.data(),
        } as InvoiceDoc;

        if (cancelled) return;
        setInvoice(nextInvoice);

        if (nextInvoice.orgId) {
          const orgSnap = await getDoc(
            doc(db, "organizations", nextInvoice.orgId)
          );
          if (!cancelled && orgSnap.exists()) {
            setOrganization({
              id: orgSnap.id,
              ...(orgSnap.data() as Omit<Org, "id">),
            });
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load this invoice."
          );
        }
      }
    }

    void loadInvoice();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    document.body.classList.add("rz-document-open");
    return () => document.body.classList.remove("rz-document-open");
  }, []);

  const companyName = useMemo(
    () =>
      organization?.legalName?.trim() ||
      organization?.name?.trim() ||
      "Your Roofing Company",
    [organization]
  );

  const companyAddress = useMemo(
    () => formatOrgAddress(organization?.address ?? null),
    [organization?.address]
  );

  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/invoices-page");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  const shell = (
    <div className="paystub-print fixed inset-0 z-[9999] overflow-y-auto bg-[#e9eef4] text-slate-900 print:static print:overflow-visible print:bg-white">
      <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/92 px-3 py-3 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex w-full max-w-[920px] items-center justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {copied ? "Copied" : "Copy link"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <Printer className="h-4 w-4" />
              Print / PDF
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[920px] px-3 py-5 sm:px-5 sm:py-8 print:max-w-none print:p-0">
        {error ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-sm print:hidden">
            <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
              <FileText className="h-4 w-4" />
              Invoice unavailable
            </div>
            <p className="mt-2 text-sm text-red-600">{error}</p>
          </div>
        ) : !invoice ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm print:hidden">
            Preparing invoice…
          </div>
        ) : (
          <article className="rz-print-document invoice-print-document paystub-print-inner overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(36,52,71,0.13)] print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
            <header className="rz-document-header border-b-2 border-slate-900 px-5 pb-6 pt-5 sm:px-8 sm:pb-8 sm:pt-8 print:px-0 print:pb-5 print:pt-0">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-start gap-4">
                    <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-white p-1 sm:h-16 sm:w-16 print:border-slate-300">
                      <img
                        src={organization?.logoUrl?.trim() || fallbackLogo}
                        alt={`${companyName} logo`}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-base font-bold leading-tight text-slate-950 sm:text-lg">
                        {companyName}
                      </div>
                      {companyAddress ? (
                        <div className="mt-1 max-w-md text-[11px] leading-5 text-slate-600">
                          {companyAddress}
                        </div>
                      ) : null}
                      {organization?.phone || organization?.email ? (
                        <div className="mt-1 text-[11px] leading-5 text-slate-600">
                          {[organization?.phone, organization?.email]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 sm:text-right">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    {invoice.kind === "receipt" ? "Receipt" : "Invoice"}
                  </div>
                  <div className="mt-1 text-xl font-bold tracking-tight text-slate-950">
                    #{invoice.number}
                  </div>
                  <span
                    className={[
                      "mt-3 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                      statusClasses(invoice.status),
                    ].join(" ")}
                  >
                    {invoice.status}
                  </span>
                </div>
              </div>
            </header>

            <div className="px-5 py-6 sm:px-8 sm:py-8 print:px-0 print:py-5">
              <section className="rz-print-keep grid gap-5 border-b border-slate-200 pb-6 sm:grid-cols-[1fr_1fr_180px] print:grid-cols-[1fr_1fr_160px]">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">
                    Bill to
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-700">
                    <div className="font-bold text-slate-950">
                      {invoice.customer?.name || "Customer"}
                    </div>
                    {invoice.customer?.email ? (
                      <div>{invoice.customer.email}</div>
                    ) : null}
                    {invoice.customer?.phone ? (
                      <div>{invoice.customer.phone}</div>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">
                    Job address
                  </div>
                  <div className="mt-2 text-sm font-semibold leading-6 text-slate-900">
                    {invoice.addressSnapshot?.fullLine ||
                      invoice.addressSnapshot?.line1 ||
                      "—"}
                    {invoice.addressSnapshot?.city ||
                    invoice.addressSnapshot?.state ||
                    invoice.addressSnapshot?.zip ? (
                      <div className="font-normal text-slate-600">
                        {[
                          invoice.addressSnapshot?.city,
                          [
                            invoice.addressSnapshot?.state,
                            invoice.addressSnapshot?.zip,
                          ]
                            .filter(Boolean)
                            .join(" "),
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                    ) : null}
                  </div>
                </div>

                <dl className="grid content-start gap-3 text-xs">
                  <div className="flex justify-between gap-3 sm:block sm:text-right">
                    <dt className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                      Issued
                    </dt>
                    <dd className="mt-0.5 font-semibold text-slate-900">
                      {formatDate(invoice.createdAt)}
                    </dd>
                  </div>
                  {invoice.dueDate ? (
                    <div className="flex justify-between gap-3 sm:block sm:text-right">
                      <dt className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                        Due
                      </dt>
                      <dd className="mt-0.5 font-semibold text-slate-900">
                        {formatDate(invoice.dueDate)}
                      </dd>
                    </div>
                  ) : null}
                  {invoice.terms ? (
                    <div className="flex justify-between gap-3 sm:block sm:text-right">
                      <dt className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                        Terms
                      </dt>
                      <dd className="mt-0.5 font-semibold text-slate-900">
                        {invoice.terms}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </section>

              {invoice.builderInfo?.poNumber ||
              invoice.insuranceInfo ||
              invoice.otherInfo?.reference ? (
                <section className="rz-print-keep mt-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-2 print:bg-white">
                  {invoice.builderInfo?.poNumber ? (
                    <div>
                      <span className="font-bold text-slate-500">
                        PO / reference:
                      </span>{" "}
                      <span className="font-semibold text-slate-900">
                        {invoice.builderInfo.poNumber}
                      </span>
                    </div>
                  ) : null}
                  {invoice.insuranceInfo?.carrier ? (
                    <div>
                      <span className="font-bold text-slate-500">Carrier:</span>{" "}
                      <span className="font-semibold text-slate-900">
                        {invoice.insuranceInfo.carrier}
                      </span>
                    </div>
                  ) : null}
                  {invoice.insuranceInfo?.claimNumber ? (
                    <div>
                      <span className="font-bold text-slate-500">Claim #:</span>{" "}
                      <span className="font-semibold text-slate-900">
                        {invoice.insuranceInfo.claimNumber}
                      </span>
                    </div>
                  ) : null}
                  {invoice.insuranceInfo?.policyNumber ? (
                    <div>
                      <span className="font-bold text-slate-500">Policy #:</span>{" "}
                      <span className="font-semibold text-slate-900">
                        {invoice.insuranceInfo.policyNumber}
                      </span>
                    </div>
                  ) : null}
                  {invoice.otherInfo?.reference ? (
                    <div className="sm:col-span-2">
                      <span className="font-bold text-slate-500">
                        Additional reference:
                      </span>{" "}
                      <span className="text-slate-900">
                        {invoice.otherInfo.reference}
                      </span>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {invoice.description ? (
                <section className="rz-print-keep mt-5">
                  <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">
                    Work summary
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {invoice.description}
                  </p>
                </section>
              ) : null}

              <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 print:overflow-visible print:rounded-none">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-slate-100 text-[9px] uppercase tracking-[0.14em] text-slate-600 print:bg-slate-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold">
                        Description
                      </th>
                      <th className="w-40 px-4 py-3 text-right font-bold">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {invoice.lines.map((line) => (
                      <tr key={line.id} className="rz-print-keep">
                        <td className="px-4 py-3 text-slate-700">
                          {displayLineLabel(line.label)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-950">
                          {money(line.amountCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="rz-print-keep mt-5 flex justify-end">
                <dl className="w-full max-w-[330px] text-sm">
                  <div className="flex justify-between gap-6 py-1.5">
                    <dt className="text-slate-500">Subtotal</dt>
                    <dd className="font-semibold tabular-nums text-slate-900">
                      {money(invoice.money?.subtotalCents)}
                    </dd>
                  </div>
                  {(invoice.money?.taxCents ?? 0) > 0 ? (
                    <div className="flex justify-between gap-6 py-1.5">
                      <dt className="text-slate-500">Tax</dt>
                      <dd className="font-semibold tabular-nums text-slate-900">
                        {money(invoice.money?.taxCents)}
                      </dd>
                    </div>
                  ) : null}
                  <div className="mt-2 flex justify-between gap-6 border-t-2 border-slate-900 pt-3 text-base">
                    <dt className="font-bold text-slate-950">Total</dt>
                    <dd className="font-bold tabular-nums text-slate-950">
                      {money(invoice.money?.totalCents)}
                    </dd>
                  </div>
                  {invoice.paymentNote ? (
                    <div className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-700 print:border print:border-slate-200 print:bg-white">
                      {invoice.paymentNote}
                    </div>
                  ) : null}
                </dl>
              </section>

              <footer className="rz-print-keep mt-10 border-t border-slate-200 pt-4 text-[10px] leading-5 text-slate-500">
                Thank you for your business. Questions about this document can
                be directed to {companyName}
                {organization?.phone ? ` at ${organization.phone}` : ""}.
                <span className="mt-1 block">
                  This {invoice.kind} remains connected to the Roof Zeus job
                  record for future reference.
                </span>
              </footer>
            </div>
          </article>
        )}
      </div>
    </div>
  );

  return createPortal(shell, document.body);
}
