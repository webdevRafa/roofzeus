import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { motion } from "framer-motion";
import { CheckCircle2, ChevronRight, FileText } from "lucide-react";
import type {
  Employee,
  PayoutDoc,
  EmployeeAddress,
  Job,
  Organization,
  Address,
} from "../types/types";
import { db } from "../firebase/firebaseConfig";
import { useOrg } from "../contexts/OrgContext";
import fallbackLogo from "../assets/rogers-roofing.webp";

export type GlobalPayoutStubModalProps = {
  employee: Employee | null;
  payouts: PayoutDoc[];
  onClose: () => void;
  onConfirmPaid: () => Promise<void>;
  saving: boolean;

  firstStubGuideStep?: "print" | "markPaid" | null;
  onFirstStubGuideStepChange?: (step: "print" | "markPaid" | null) => void;
  onDismissFirstStubGuide?: () => void;
};

// Normalize Employee.address into a consistent shape
function normalizeEmployeeAddress(
  a: Employee["address"]
): EmployeeAddress | null {
  if (!a) return null;
  if (typeof a === "string") return { fullLine: a, line1: a };
  return a as EmployeeAddress;
}

// Simple money formatter for non-animated numbers (used in payouts section)
function money(cents: number | null | undefined): string {
  const v = typeof cents === "number" ? cents : 0;
  return (v / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function formatIssuedDate(date = new Date()): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function makeStubNumber(payouts: PayoutDoc[]): string {
  const seed = payouts
    .map((p) => p.id)
    .filter(Boolean)
    .join("-");

  if (!seed) return `RZ-${Date.now().toString().slice(-6)}`;

  return `RZ-${seed
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase()}`;
}

// ---- Address normalizer (string or object, supports `fullLine`) ----
function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return "";
}
function addr(a: Job["address"] | null | undefined) {
  if (typeof a === "string")
    return { display: a, line1: a, city: "", state: "", zip: "" };
  const obj: Record<string, unknown> =
    (a as unknown as Record<string, unknown>) ?? {};
  const line1 = pickString(obj, [
    "fullLine",
    "line1",
    "street",
    "address1",
    "address",
    "full",
    "formatted",
    "text",
    "label",
    "line",
    "street1",
  ]);
  const city = pickString(obj, ["city", "town"]);
  const state = pickString(obj, ["state", "region", "province"]);
  const zip = pickString(obj, ["zip", "postalCode", "postcode", "zipCode"]);
  const display =
    pickString(obj, ["fullLine", "full", "formatted", "label", "text"]) ||
    line1;
  return { display, line1, city, state, zip };
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

function formatWorkDate(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) return ymd;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dayRateSummary(p: PayoutDoc) {
  const dates = Array.isArray((p as any).workedDates)
    ? ((p as any).workedDates as string[])
    : [];

  if (dates.length > 0) {
    return dates.map(formatWorkDate).join(", ");
  }

  const memo = (p as any).note || (p as any).memo;
  if (typeof memo === "string" && memo.trim()) return memo.trim();

  return "Day-rate work";
}

export function GlobalPayoutStubModal({
  payouts,
  employee,
  onClose,
  onConfirmPaid,
  saving,
  firstStubGuideStep = null,
  onFirstStubGuideStepChange,
  onDismissFirstStubGuide,
}: GlobalPayoutStubModalProps) {
  const showPrintGuide = firstStubGuideStep === "print";
  const showMarkPaidGuide = firstStubGuideStep === "markPaid";

  const [hidePrintGuideCallout, setHidePrintGuideCallout] = useState(false);

  const showPrintGuideCallout = showPrintGuide && !hidePrintGuideCallout;
  const shouldBlurTableForPrintGuide = showPrintGuideCallout;

  useEffect(() => {
    if (firstStubGuideStep !== "print") {
      setHidePrintGuideCallout(false);
    }
  }, [firstStubGuideStep]);

  function handlePrintSavePdf() {
    window.print();

    // window.print() resumes after the print preview closes in modern browsers,
    // so Step 4 appears after the user exits the print/save flow.
    onFirstStubGuideStepChange?.("markPaid");
  }

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

  const orgDisplayName = useMemo(() => {
    return (
      org?.legalName?.trim() || org?.name?.trim() || "Your Roofing Company"
    );
  }, [org]);

  const orgAddressLine = useMemo(() => {
    return formatOrgAddress(org?.address ?? null);
  }, [org]);

  const orgLogoSrc = org?.logoUrl?.trim() || fallbackLogo;

  const totalCents = payouts.reduce(
    (sum, p) => sum + ((p as any).amountCents ?? 0),
    0
  );

  const issuedDate = formatIssuedDate();
  const stubNumber = makeStubNumber(payouts);

  const isDayRateStub =
    payouts.length > 0 && payouts.every((p) => p.category === "technician");

  // Use the helper we created earlier to normalize the employee address
  const empAddr = employee ? normalizeEmployeeAddress(employee.address) : null;

  const formatCategory = (category: PayoutDoc["category"] | undefined) => {
    if (category === "shingles") return "Shingles";

    // 🔥 UX upgrade here
    if (category === "felt") return "Dry In";

    if (category === "technician") return "Technician";

    return "";
  };

  // In browsers, render the stub into <body> via a portal
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="paystub-print fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/60 p-3 pt-5 sm:p-4 sm:pt-6 print:block print:overflow-visible print:bg-white print:p-0">
      <div
        className={[
          "paystub-print-inner flex max-h-[calc(100dvh-2.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-sm border-none",
          "bg-[var(--color-card)]",
          "print:block print:max-h-none print:overflow-visible print:bg-white print:text-black print:border-transparent print:shadow-none print:rounded-none print:py-0",
        ].join(" ")}
      >
        {/* Header / document identity */}
        <div
          className="relative shrink-0 p-4 border-b print:border-gray-200"
          style={{ borderColor: "rgba(58,63,75,0.75)" }}
        >
          <div className="w-full flex justify-end mb-2 print:hidden">
            <button
              type="button"
              onClick={onClose}
              className={[
                "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border",
                "border-[rgb(var(--color-border-rgb)/0.28)] bg-[rgb(var(--color-text-rgb)/0.05)]",
                "px-4 py-2 text-sm font-bold text-[var(--color-text)] transition",
                "hover:border-[rgb(var(--color-border-rgb)/0.42)] hover:bg-[rgb(var(--color-text-rgb)/0.10)]",
                "focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary-rgb)/0.24)]",
              ].join(" ")}
            >
              Close
            </button>
          </div>
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex gap-3 items-center">
                <img
                  src={orgLogoSrc}
                  className="h-[76px] w-[92px] rounded-md object-contain bg-white"
                  alt={`${orgDisplayName} logo`}
                />

                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-semibold leading-tight print:text-black">
                    {orgDisplayName}
                  </h2>

                  {orgAddressLine ? (
                    <div className="text-xs text-white/60 print:text-gray-600">
                      {orgAddressLine}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45 print:text-gray-500">
                Earnings Statement
              </div>

              <div className="mt-2 space-y-0.5 text-[11px] text-white/55 print:text-gray-600">
                <div>
                  <span className="font-semibold text-white/75 print:text-gray-800">
                    Stub #:
                  </span>{" "}
                  {stubNumber}
                </div>

                <div>
                  <span className="font-semibold text-white/75 print:text-gray-800">
                    Issue date:
                  </span>{" "}
                  {issuedDate}
                </div>
              </div>
            </div>
          </div>

          {/* Payee block */}
          {employee && (
            <div className="relative mt-2 rounded-sm  p-3 print:border-gray-200 print:bg-gray-50">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45 print:text-gray-500">
                Pay to
              </div>

              <div className="mt-1">
                <div className="text-sm font-semibold text-white print:text-black">
                  {employee.name}
                </div>

                {empAddr && (
                  <div className="mt-1 text-xs text-white/60 print:text-black">
                    {(empAddr.fullLine || empAddr.line1) && (
                      <div>{empAddr.fullLine || empAddr.line1}</div>
                    )}

                    {(empAddr.city || empAddr.state || empAddr.zip) && (
                      <div>
                        {[empAddr.city, empAddr.state, empAddr.zip]
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Earnings table */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-5 pb-4 section-scroll print:block print:overflow-visible print:p-0">
          <div className="mb-2 flex items-end justify-between print:px-5 print:pt-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45 print:text-gray-500">
                Earnings breakdown
              </div>
              <div className="text-xs text-white/55 print:text-gray-600">
                Roofing labor payouts included in this statement
              </div>
            </div>
          </div>
          <div className="relative">
            {showPrintGuideCallout ? (
              <div className="pointer-events-none absolute inset-0 z-10 rounded-sm bg-black/10" />
            ) : null}

            <div
              className={[
                "overflow-hidden rounded-sm  print:rounded-none  transition-all duration-300",
                shouldBlurTableForPrintGuide
                  ? "blur-[2px] pointer-events-none select-none"
                  : "",
              ].join(" ")}
              style={{ borderColor: "rgba(58,63,75,0.75)" }}
            >
              <table className="min-w-full text-xs sm:text-sm">
                <thead
                  className="text-[11px] uppercase tracking-wide print:bg-gray-50"
                  style={{ backgroundColor: "rgba(11,14,20,0.45)" }}
                >
                  {isDayRateStub ? (
                    <tr>
                      <th className="px-3 py-2 text-left text-white/60 print:text-gray-600">
                        Work dates
                      </th>
                      <th className="px-3 py-2 text-left text-white/60 print:text-gray-600">
                        Days
                      </th>
                      <th className="px-3 py-2 text-left text-white/60 print:text-gray-600">
                        Rate
                      </th>
                      <th className="px-3 py-2 text-left text-white/60 print:text-gray-600">
                        Notes
                      </th>
                      <th className="px-3 py-2 text-right text-white/60 print:text-gray-600">
                        Total
                      </th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="px-3 py-2 text-left text-white/60 print:text-gray-600">
                        Address
                      </th>
                      <th className="px-3 py-2 text-left text-white/60 print:text-gray-600">
                        Labor
                      </th>
                      <th className="px-3 py-2 text-left text-white/60 print:text-gray-600">
                        Sq Count
                      </th>
                      <th className="px-3 py-2 text-left text-white/60 print:text-gray-600">
                        Rate
                      </th>
                      <th className="px-3 py-2 text-right text-white/60 print:text-gray-600">
                        Total
                      </th>
                    </tr>
                  )}
                </thead>

                <tbody>
                  {payouts.map((p) => {
                    if (isDayRateStub) {
                      const days =
                        typeof (p as any).daysWorked === "number"
                          ? (p as any).daysWorked
                          : Array.isArray((p as any).workedDates)
                          ? (p as any).workedDates.length
                          : 0;

                      const ratePerDayCents =
                        typeof (p as any).ratePerDayCents === "number"
                          ? (p as any).ratePerDayCents
                          : days > 0
                          ? Math.round(((p as any).amountCents ?? 0) / days)
                          : 0;

                      const note = (p as any).note || (p as any).memo || "—";

                      return (
                        <tr
                          key={p.id}
                          className="border-t print:border-gray-200 print:font-semibold"
                          style={{ borderColor: "rgba(58,63,75,0.65)" }}
                        >
                          <td className="px-3 py-2 align-top text-white/85 print:text-gray-800">
                            {dayRateSummary(p)}
                          </td>

                          <td className="px-3 py-2 align-top text-white/80 print:text-gray-800">
                            {days || "—"}
                          </td>

                          <td className="px-3 py-2 align-top text-white/80 print:text-gray-800">
                            {ratePerDayCents
                              ? `${money(ratePerDayCents)}/day`
                              : "—"}
                          </td>

                          <td className="px-3 py-2 align-top text-white/70 print:text-gray-700">
                            {note}
                          </td>

                          <td className="px-3 py-2 align-top text-right font-semibold text-white print:text-black">
                            {money((p as any).amountCents ?? 0)}
                          </td>
                        </tr>
                      );
                    }

                    const a = addr((p as any).jobAddressSnapshot as any);
                    const materialLabel = formatCategory(p.category);

                    return (
                      <tr
                        key={p.id}
                        className="border-t print:border-gray-100"
                        style={{ borderColor: "rgba(58,63,75,0.65)" }}
                      >
                        <td className="px-3 py-2 align-top">
                          <div className=" text-white print:text-black">
                            {a.display || "—"}
                          </div>
                          {(a.city || a.state || a.zip) && (
                            <div className="text-[11px] text-white/50 print:text-gray-600">
                              {[a.city, a.state, a.zip]
                                .filter(Boolean)
                                .join(", ")}
                            </div>
                          )}
                        </td>

                        <td className="px-3 py-2 align-top text-white/80 print:text-gray-800">
                          {materialLabel || "—"}
                        </td>

                        <td className="px-3 py-2 align-top text-white/80 print:text-gray-800">
                          {typeof (p as any).sqft === "number"
                            ? (p as any).sqft.toLocaleString()
                            : "—"}
                        </td>

                        <td className="px-3 py-2 align-top text-white/80 print:text-gray-800">
                          {typeof (p as any).ratePerSqFt === "number"
                            ? `$${(p as any).ratePerSqFt.toFixed(2)} / sq`
                            : "—"}
                        </td>

                        <td className="px-3 py-2 align-top text-right  text-white print:text-black">
                          {money((p as any).amountCents ?? 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Totals + actions */}
        <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-card)] px-5 py-3 sm:flex sm:items-center sm:justify-between print:hidden">
          <div className="text-sm text-white/70">
            <div className="text-xs text-white/50">
              <span className="font-medium text-white/70">
                Number of payouts:
              </span>{" "}
              {payouts.length}
            </div>
            <div className="mt-1 text-lg font-semibold text-white">
              Net pay: &nbsp;
              <span style={{ color: "rgba(207,174,93,0.95)" }}>
                {money(totalCents)}
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 sm:mt-0">
            <div className="relative">
              {showPrintGuide ? (
                <motion.span
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-1.5 rounded-2xl border border-[rgb(var(--color-primary-rgb)/0.55)] bg-[rgb(var(--color-primary-rgb)/0.08)]"
                  animate={{
                    opacity: [0.55, 1, 0.55],
                    scale: [1, 1.045, 1],
                  }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              ) : null}

              <button
                type="button"
                onClick={handlePrintSavePdf}
                className={[
                  "relative z-10 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[rgb(var(--color-primary-rgb)/0.28)] bg-[rgb(var(--color-primary-rgb)/0.05)] px-4 py-2 text-sm font-bold text-[var(--color-text)] transition hover:bg-[rgb(var(--color-primary-rgb)/0.16)]",
                  showPrintGuide
                    ? "shadow-[0_0_0_6px_rgb(var(--color-primary-rgb)/0.10),0_0_34px_rgb(var(--color-primary-rgb)/0.36)]"
                    : "",
                ].join(" ")}
              >
                <FileText className="h-4 w-4 text-[rgb(var(--color-primary-rgb))]" />
                Print / Save PDF
              </button>

              {showPrintGuideCallout ? (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute bottom-full right-0 z-50 mb-3 w-[320px] rounded-2xl border border-[rgb(var(--color-primary-rgb)/0.28)] bg-[var(--color-card)] p-4 text-left shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[rgb(var(--color-primary-rgb)/0.28)] bg-[rgb(var(--color-primary-rgb)/0.12)] text-[var(--color-primary)]">
                      <FileText className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-primary)]">
                        Step 3 of 4
                      </div>

                      <div className="mt-1 text-sm font-extrabold text-[var(--color-text)]">
                        Save or print the pay stub
                      </div>

                      <p className="mt-1 text-xs leading-5 text-[rgb(var(--color-text-rgb)/0.64)]">
                        Review the stub first, then use this button to print it
                        or save it as a PDF for your records.
                      </p>

                      <button
                        type="button"
                        onClick={() => setHidePrintGuideCallout(true)}
                        className="mt-3 text-[11px] font-semibold text-[rgb(var(--color-text-rgb)/0.48)] hover:text-[var(--color-text)]"
                      >
                        Not now
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </div>

            <div className="relative">
              {showMarkPaidGuide ? (
                <motion.span
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-1.5 rounded-2xl border border-[rgb(var(--pill-success-rgb)/0.65)] bg-[rgb(var(--pill-success-rgb)/0.10)]"
                  animate={{
                    opacity: [0.55, 1, 0.55],
                    scale: [1, 1.045, 1],
                  }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              ) : null}

              <button
                type="button"
                onClick={onConfirmPaid}
                disabled={saving}
                className={[
                  "relative z-10 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[rgb(var(--pill-success-rgb)/0.28)] bg-[rgb(var(--pill-success-rgb)/0.05)] px-4 py-2 text-sm font-bold text-[var(--color-text)] transition hover:bg-[rgb(var(--pill-success-rgb)/0.16)] disabled:cursor-not-allowed disabled:opacity-40",
                  showMarkPaidGuide
                    ? "shadow-[0_0_0_6px_rgb(var(--pill-success-rgb)/0.10),0_0_34px_rgb(var(--pill-success-rgb)/0.36)]"
                    : "",
                ].join(" ")}
              >
                <CheckCircle2 className="h-4 w-4 text-[rgb(var(--pill-success-rgb))]" />
                {saving ? "Marking as paid…" : "Mark all as paid"}
              </button>

              {showMarkPaidGuide ? (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute bottom-full right-0 z-50 mb-3 w-[320px] rounded-2xl border border-[rgb(var(--pill-success-rgb)/0.30)] bg-[var(--color-card)] p-4 text-left shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[rgb(var(--pill-success-rgb)/0.30)] bg-[rgb(var(--pill-success-rgb)/0.12)] text-[rgb(var(--pill-success-rgb))]">
                      <ChevronRight className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-[rgb(var(--pill-success-rgb))]">
                        Step 4 of 4
                      </div>

                      <div className="mt-1 text-sm font-extrabold text-[var(--color-text)]">
                        Mark payouts as paid
                      </div>

                      <p className="mt-1 text-xs leading-5 text-[rgb(var(--color-text-rgb)/0.64)]">
                        Once the stub is saved, mark these payouts as paid.
                        RoofZeus will update your payout ledger and save this
                        stub in your history.
                      </p>

                      <button
                        type="button"
                        onClick={onDismissFirstStubGuide}
                        className="mt-3 text-[11px] font-semibold text-[rgb(var(--color-text-rgb)/0.48)] hover:text-[var(--color-text)]"
                      >
                        Not now
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </div>
          </div>
        </div>

        {/* PRINT-ONLY totals + compliance footer */}
        <div className="hidden print:block p-5">
          <div className="ml-auto w-[240px] border-t border-gray-300 pt-3">
            <div className="flex justify-between text-[11px] text-black">
              <span>Subtotal</span>
              <span>{money(totalCents)}</span>
            </div>

            <div className="mt-1 flex justify-between text-[11px] text-black">
              <span>Deductions</span>
              <span>$0.00</span>
            </div>

            <div className="mt-2 flex justify-between border-t font-semibold border-gray-300 pt-2 text-sm  text-black">
              <span>Net pay</span>
              <span>{money(totalCents)}</span>
            </div>
          </div>

          <div className="mt-8 border-t border-gray-200 pt-3 text-[10px] leading-4 text-gray-500">
            This document serves as a record of roofing labor earnings and
            payouts issued by the company listed above. Roof Zeus provides
            document generation and recordkeeping tools only and does not
            provide tax, payroll, legal, or accounting advice. Contractors and
            workers are responsible for their own reporting obligations.
          </div>

          <div className="mt-2 text-[10px] text-gray-400">
            Generated by Roof Zeus • {issuedDate}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
