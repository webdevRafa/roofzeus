import { createPortal } from "react-dom";
import type { Employee, PayoutDoc, EmployeeAddress, Job } from "../types/types";
import logo from "../assets/rogers-roofing.webp";

export type GlobalPayoutStubModalProps = {
  employee: Employee | null; // EmployeeDetailPage can just pass non-null
  payouts: PayoutDoc[];
  onClose: () => void;
  onConfirmPaid: () => Promise<void>;
  saving: boolean;
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

export function GlobalPayoutStubModal({
  payouts,
  employee,
  onClose,
  onConfirmPaid,
  saving,
}: GlobalPayoutStubModalProps) {
  const totalCents = payouts.reduce(
    (sum, p) => sum + ((p as any).amountCents ?? 0),
    0
  );

  // Use the helper we created earlier to normalize the employee address
  const empAddr = employee ? normalizeEmployeeAddress(employee.address) : null;

  const formatCategory = (category: PayoutDoc["category"] | undefined) => {
    if (category === "shingles") return "Shingles";
    if (category === "felt") return "Felt";
    if (category === "technician") return "Technician";
    return "";
  };

  // In browsers, render the stub into <body> via a portal
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="paystub-print fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 print:bg-white print:p-0">
      <div
        className={[
          "paystub-print-inner w-full max-w-3xl rounded-2xl border shadow-[0_24px_80px_rgba(0,0,0,0.55)] overflow-hidden",
          "bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)]",
          "print:bg-white print:text-black print:border-transparent print:shadow-none print:rounded-none",
        ].join(" ")}
      >
        {/* Top bar */}
        <div
          className="relative px-5 py-4 border-b print:border-gray-200"
          style={{ borderColor: "rgba(58,63,75,0.75)" }}
        >
          {/* subtle glows (screen only) */}
          <div
            className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full blur-3xl print:hidden"
            style={{ backgroundColor: "rgba(207,174,93,0.10)" }}
          />
          <div
            className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full blur-3xl print:hidden"
            style={{ backgroundColor: "rgba(245,246,248,0.06)" }}
          />

          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex gap-3 items-center">
                <img src={logo} className="max-w-[92px] rounded-md" alt="" />
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-semibold leading-tight print:text-black">
                    Roger&apos;s Roofing &amp; Contracting LLC
                  </h2>
                  <div className="text-xs text-white/60 print:text-gray-600">
                    3618 Angus Crossing • San Antonio, Texas 75245
                  </div>
                </div>
              </div>

              {/* Dynamic employee info */}
              {employee && (
                <div className="mt-4">
                  <div className="text-sm font-semibold text-white print:text-black">
                    {employee.name}
                  </div>

                  {empAddr && (
                    <div className="mt-1 text-xs text-white/60 print:text-gray-700">
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
              )}
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border px-3 py-2 text-xs font-semibold transition print:hidden"
                style={{
                  borderColor: "rgba(58,63,75,0.85)",
                  backgroundColor: "rgba(255,255,255,0.04)",
                  color: "rgba(245,246,248,0.85)",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="p-5 print:p-0">
          <div
            className="overflow-hidden rounded-2xl border print:rounded-none print:border-gray-200"
            style={{ borderColor: "rgba(58,63,75,0.75)" }}
          >
            <table className="min-w-full text-xs sm:text-sm">
              <thead
                className="text-[11px] uppercase tracking-wide print:bg-gray-50"
                style={{ backgroundColor: "rgba(11,14,20,0.45)" }}
              >
                <tr>
                  <th className="px-3 py-2 text-left text-white/60 print:text-gray-600">
                    Address
                  </th>
                  <th className="px-3 py-2 text-left text-white/60 print:text-gray-600">
                    Material
                  </th>
                  <th className="px-3 py-2 text-left text-white/60 print:text-gray-600">
                    SqCount
                  </th>
                  <th className="px-3 py-2 text-left text-white/60 print:text-gray-600">
                    Rate
                  </th>
                  <th className="px-3 py-2 text-right text-white/60 print:text-gray-600">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {payouts.map((p) => {
                  const a = addr((p as any).jobAddressSnapshot as any);
                  const materialLabel = formatCategory(p.category);

                  return (
                    <tr
                      key={p.id}
                      className="border-t print:border-gray-200"
                      style={{ borderColor: "rgba(58,63,75,0.65)" }}
                    >
                      {/* Address */}
                      <td className="px-3 py-2 align-top">
                        <div className="font-medium text-white print:text-black">
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

                      {/* Material */}
                      <td className="px-3 py-2 align-top text-white/80 print:text-gray-800">
                        {materialLabel || "—"}
                      </td>

                      {/* SqCount */}
                      <td className="px-3 py-2 align-top text-white/80 print:text-gray-800">
                        {typeof (p as any).sqft === "number"
                          ? (p as any).sqft.toLocaleString()
                          : "—"}
                      </td>

                      {/* Rate */}
                      <td className="px-3 py-2 align-top text-white/80 print:text-gray-800">
                        {typeof (p as any).ratePerSqFt === "number"
                          ? `$${(p as any).ratePerSqFt.toFixed(2)}/sq.ft`
                          : "—"}
                      </td>

                      {/* Total */}
                      <td className="px-3 py-2 align-top text-right font-semibold text-white print:text-black">
                        {money((p as any).amountCents ?? 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals + actions */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
            <div className="text-sm text-white/70">
              <div className="text-xs text-white/50">
                <span className="font-medium text-white/70">
                  Number of payouts:
                </span>{" "}
                {payouts.length}
              </div>
              <div className="mt-1 text-lg font-semibold text-white">
                Total:{" "}
                <span style={{ color: "rgba(207,174,93,0.95)" }}>
                  {money(totalCents)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl border px-3 py-2 text-xs font-semibold transition"
                style={{
                  borderColor: "rgba(58,63,75,0.85)",
                  backgroundColor: "rgba(255,255,255,0.04)",
                  color: "rgba(245,246,248,0.85)",
                }}
              >
                Print / Save PDF
              </button>

              <button
                type="button"
                onClick={onConfirmPaid}
                disabled={saving}
                className="rounded-xl px-4 py-2 text-xs font-semibold transition disabled:opacity-60"
                style={{
                  backgroundColor: "rgba(16,185,129,0.85)",
                  color: "white",
                }}
              >
                {saving ? "Marking as paid…" : "Mark all as paid"}
              </button>
            </div>
          </div>

          {/* PRINT-ONLY totals */}
          <div className="hidden print:flex w-full justify-end p-5">
            <div className="text-right">
              <div className="text-[11px] text-gray-600">Grand total</div>
              <div className="mt-1 text-lg font-semibold text-black">
                {money(totalCents)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
