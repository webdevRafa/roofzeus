import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import type {
  Address,
  EmployeeAddress,
  Job,
  Organization,
  PayoutStubDoc,
  PayoutStubLine,
} from "../types/types";
import { db } from "../firebase/firebaseConfig";
import { useOrg } from "../contexts/OrgContext";
import fallbackLogo from "../assets/rogers-roofing.webp";

export type PayoutStubViewerModalProps = {
  stub: PayoutStubDoc;
  onClose: () => void;
  employeeNameOverride?: string;
};

function money(cents: number | null | undefined): string {
  const v = typeof cents === "number" ? cents : 0;
  return (v / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

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

  const fullLine = address.fullLine?.trim();
  if (fullLine) return fullLine;

  const line1 = address.line1 || address.street || "";
  const cityStateZip = [
    address.city,
    address.state,
    address.zip || address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

  return [line1, cityStateZip].filter(Boolean).join(" • ");
}

type FsTimestampLike = { toDate: () => Date };

function isFsTimestamp(x: unknown): x is FsTimestampLike {
  return typeof (x as FsTimestampLike)?.toDate === "function";
}

function fmtDate(x: unknown): string {
  if (x == null) return "—";
  if (isFsTimestamp(x)) return x.toDate().toLocaleDateString();
  if (x instanceof Date) return x.toLocaleDateString();

  if (typeof x === "string" || typeof x === "number") {
    const d = new Date(x);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
  }

  return "—";
}

function formatCategory(category: PayoutStubLine["category"] | undefined) {
  if (category === "shingles") return "Shingles";
  if (category === "felt") return "Dry In";
  if (category === "technician") return "Technician";
  return "";
}

function normalizeEmployeeAddress(
  a: PayoutStubDoc["employeeAddressSnapshot"]
): EmployeeAddress | null {
  if (!a) return null;
  if (typeof a === "string") return { fullLine: a, line1: a };
  return a as EmployeeAddress;
}

export function PayoutStubViewerModal({
  stub,
  onClose,
  employeeNameOverride,
}: PayoutStubViewerModalProps) {
  const { orgId: activeOrgId } = useOrg();
  const [org, setOrg] = useState<Organization | null>(null);

  const resolvedOrgId = (stub as any).orgId || activeOrgId;

  useEffect(() => {
    if (!resolvedOrgId) {
      setOrg(null);
      return;
    }

    const ref = doc(db, "organizations", resolvedOrgId);

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
  }, [resolvedOrgId]);

  const orgDisplayName = useMemo(() => {
    return (
      org?.legalName?.trim() || org?.name?.trim() || "Your Roofing Company"
    );
  }, [org]);

  const orgAddressLine = useMemo(() => {
    return formatOrgAddress(org?.address ?? null);
  }, [org]);

  const orgLogoSrc = org?.logoUrl?.trim() || fallbackLogo;

  if (typeof document === "undefined") return null;

  const empAddr = normalizeEmployeeAddress(stub.employeeAddressSnapshot);

  const totalCents =
    typeof stub.totalCents === "number"
      ? stub.totalCents
      : (stub.lines ?? []).reduce((sum, l) => sum + (l.amountCents ?? 0), 0);

  return createPortal(
    <div className="paystub-print fixed inset-0 z-[9999] grid place-items-center bg-black/60 p-4 print:bg-white print:p-0">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 hidden cursor-default print:hidden md:block"
        aria-label="Close"
      />

      <div className="paystub-print-inner relative w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text)] shadow-[0_24px_80px_rgba(0,0,0,0.55)] print:max-w-none print:rounded-none print:border-0 print:bg-white print:text-black print:shadow-none">
        {/* Header */}
        <div className="relative border-b border-[var(--color-border)] px-5 py-4 print:border-gray-200 print:px-0 print:py-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <img
                  src={orgLogoSrc}
                  className="h-[76px] w-[92px] rounded-md bg-white object-contain"
                  alt={`${orgDisplayName} logo`}
                />

                <div className="min-w-0">
                  <h2 className="text-xl font-semibold leading-tight text-[var(--color-text)] print:text-black">
                    {orgDisplayName}
                  </h2>

                  {orgAddressLine && (
                    <p className="mt-1 text-xs text-[var(--color-text)]/60 print:text-gray-600">
                      {orgAddressLine}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5">
                <h3 className="text-base font-semibold text-[var(--color-text)] print:text-black">
                  {employeeNameOverride?.trim() ||
                    stub.employeeNameSnapshot ||
                    "Employee"}
                </h3>

                {employeeNameOverride &&
                  stub.employeeNameSnapshot &&
                  employeeNameOverride.trim() !== stub.employeeNameSnapshot && (
                    <div className="mt-1 text-[11px] text-[var(--color-text)]/50 print:hidden">
                      Name on original stub: {stub.employeeNameSnapshot}
                    </div>
                  )}

                {empAddr && (
                  <div className="mt-1 text-xs leading-5 text-[var(--color-text)]/65 print:text-gray-700">
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

                <div className="mt-3 text-xs text-[var(--color-text)]/65 print:text-gray-700">
                  <div className="print:hidden">
                    <span className="font-medium">Created:</span>{" "}
                    {fmtDate(stub.createdAt)}
                  </div>

                  {stub.paidAt && (
                    <div>
                      <span className="font-medium">Paid:</span>{" "}
                      {fmtDate(stub.paidAt)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-card-hover)]"
              >
                Print / Save PDF
              </button>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-text)]/75 transition hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="px-5 py-5 print:mt-5 print:px-0 print:py-0">
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/35 print:rounded-none print:border-gray-200 print:bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--color-card-hover)]/60 print:bg-gray-50">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text)]/55 print:text-gray-600">
                  <th className="px-3 py-2">Address</th>
                  <th className="px-3 py-2">Material</th>
                  <th className="px-3 py-2">Sq.Ft</th>
                  <th className="px-3 py-2">Rate</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[var(--color-border)] print:divide-gray-200">
                {(stub.lines ?? []).map((line, idx) => {
                  const a = addr((line as any).jobAddressSnapshot as any);
                  const materialLabel = formatCategory(line.category);

                  return (
                    <tr key={`${line.payoutId}-${idx}`}>
                      <td className="px-3 py-3 align-top">
                        <div className="font-semibold text-[var(--color-text)] print:text-black">
                          {a.display || "—"}
                        </div>

                        {(a.city || a.state || a.zip) && (
                          <div className="mt-0.5 text-[11px] text-[var(--color-text)]/55 print:text-gray-600">
                            {[a.city, a.state, a.zip]
                              .filter(Boolean)
                              .join(", ")}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3 align-top text-[var(--color-text)]/75 print:text-gray-800">
                        {materialLabel || "—"}
                      </td>

                      <td className="px-3 py-3 align-top text-[var(--color-text)]/75 print:text-gray-800">
                        {typeof line.sqft === "number"
                          ? line.sqft.toLocaleString()
                          : "—"}
                      </td>

                      <td className="px-3 py-3 align-top text-[var(--color-text)]/75 print:text-gray-800">
                        {typeof line.ratePerSqFt === "number"
                          ? `$${line.ratePerSqFt.toFixed(2)}/sq.ft`
                          : "—"}
                      </td>

                      <td className="px-3 py-3 align-top text-right font-semibold text-[var(--color-text)] print:text-black">
                        {money(line.amountCents ?? 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-[var(--color-text)]/70 print:hidden">
              <div className="text-xs">
                <span className="font-medium text-[var(--color-text)]/80">
                  Number of payouts:
                </span>{" "}
                {(stub.lines ?? []).length}
              </div>

              <div className="mt-1 text-lg font-semibold text-[var(--color-text)]">
                Total:{" "}
                <span className="text-[var(--color-accent-gold)]">
                  {money(totalCents)}
                </span>
              </div>
            </div>

            <div className="hidden w-full justify-end print:flex">
              <div className="text-right">
                <div className="text-[11px] text-gray-600">Grand total</div>
                <div className="mt-1 text-lg font-semibold text-black">
                  {money(totalCents)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
