import { type Dispatch, type SetStateAction, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ChevronDown,
  Search,
  User,
  MapPin,
  BadgeDollarSign,
  Wrench,
} from "lucide-react";
import type { PayoutDoc } from "../../types/types";
import type { Job } from "../../types/types";
import { Link } from "react-router-dom";

// Same payout filter union as DashboardPage
export type PayoutFilter = "all" | "pending" | "paid";

// ---- Animation helpers ----
const EASE = [0.16, 1, 0.3, 1] as const;

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.45, ease: EASE, delay },
});

const staggerParent = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.045, delayChildren: 0.05 },
  },
};

const item = {
  initial: { opacity: 0, y: 6, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
};

// Simple money formatter
function money(cents: number | null | undefined): string {
  const v = typeof cents === "number" ? cents : 0;
  return (v / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function isFsTimestamp(val: unknown): val is { toDate: () => Date } {
  return typeof (val as { toDate?: () => Date })?.toDate === "function";
}
function toMillis(x: unknown): number | null {
  if (x == null) return null;
  let dt: Date | null = null;
  if (isFsTimestamp(x)) dt = x.toDate();
  else if (x instanceof Date) dt = x;
  else if (typeof x === "string" || typeof x === "number") {
    const candidate = new Date(x);
    if (!Number.isNaN(candidate.getTime())) dt = candidate;
  }
  return dt ? dt.getTime() : null;
}
function fmtDateTime(x: unknown): string {
  const ms = toMillis(x);
  return ms == null
    ? "—"
    : new Date(ms).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

// Address helpers & employee name snapshot
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
function payoutEmployeeName(p: PayoutDoc): string {
  const snap = (p as any).employeeNameSnapshot;
  if (!snap) return "";
  if (typeof snap === "string") return snap;

  if (typeof snap === "object") {
    return pickString(snap as Record<string, unknown>, [
      "name",
      "fullName",
      "displayName",
    ]);
  }

  return "";
}

// ---- Props ----
export interface DashboardPayoutsSectionProps {
  payoutsOpen: boolean;
  setPayoutsOpen: Dispatch<SetStateAction<boolean>>;

  payoutSearch: string;
  setPayoutSearch: Dispatch<SetStateAction<string>>;

  payoutFilter: PayoutFilter;
  setPayoutFilter: Dispatch<SetStateAction<PayoutFilter>>;

  payoutsLoading: boolean;
  payoutsError: string | null;

  pagedPayouts: PayoutDoc[];
  filteredPayoutsCount: number;

  payoutsPage: number;
  payoutsTotalPages: number;
  setPayoutsPage: Dispatch<SetStateAction<number>>;
  PAYOUTS_PER_PAGE: number;

  selectedPayoutIds: string[];
  selectedEmployeeIds: string[];
  canCreateStub: boolean;

  togglePayoutSelected: (id: string) => void;
  clearSelectedPayouts: () => void;

  onOpenPayTechnician: () => void;

  setStubOpen: Dispatch<SetStateAction<boolean>>;

  onViewJob: (jobId: string) => void;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Pill({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] tracking-wide transition",
        active
          ? "text-[var(--color-accent-gold)]"
          : "text-white/70 hover:text-white"
      )}
      style={{
        borderColor: active ? "rgba(207,174,93,0.30)" : "rgba(58,63,75,0.75)",
        backgroundColor: active
          ? "rgba(207,174,93,0.10)"
          : "rgba(255,255,255,0.04)",
      }}
    >
      {children}
    </button>
  );
}

export function DashboardPayoutsSection({
  payoutsOpen,
  setPayoutsOpen,
  payoutSearch,
  setPayoutSearch,
  payoutFilter,
  setPayoutFilter,
  payoutsLoading,
  payoutsError,
  pagedPayouts,
  filteredPayoutsCount,
  payoutsPage,
  payoutsTotalPages,
  onOpenPayTechnician,
  setPayoutsPage,
  PAYOUTS_PER_PAGE,
  selectedPayoutIds,
  selectedEmployeeIds,
  canCreateStub,
  togglePayoutSelected,
  clearSelectedPayouts,
  setStubOpen,
  onViewJob,
}: DashboardPayoutsSectionProps) {
  const showingFrom = useMemo(() => {
    if (filteredPayoutsCount === 0) return 0;
    return (payoutsPage - 1) * PAYOUTS_PER_PAGE + 1;
  }, [filteredPayoutsCount, payoutsPage, PAYOUTS_PER_PAGE]);

  const showingTo = useMemo(() => {
    if (filteredPayoutsCount === 0) return 0;
    return Math.min(payoutsPage * PAYOUTS_PER_PAGE, filteredPayoutsCount);
  }, [filteredPayoutsCount, payoutsPage, PAYOUTS_PER_PAGE]);

  return (
    <motion.section
      {...fadeUp(0.08)}
      className="mt-10 mb-40 rounded-2xl  overflow-hidden border border-[var(--color-border)] bg-[var(--color-card)] shadow-[0_18px_50px_rgba(0,0,0,0.35)]"
    >
      {/* Header */}
      <div
        className="relative px-4 sm:px-6 py-4 border-b"
        style={{ borderColor: "rgba(58,63,75,0.75)" }}
      >
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div
                className="h-9 w-9 rounded-xl border flex items-center justify-center"
                style={{
                  backgroundColor: "rgba(11,14,20,0.55)",
                  borderColor: "rgba(58,63,75,0.9)",
                }}
              >
                <BadgeDollarSign
                  className="h-5 w-5"
                  style={{ color: "var(--color-accent-gold)" }}
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-semibold text-[var(--color-text)] tracking-wide">
                    <Link to="/payouts" className="hover:underline">
                      PAYOUTS
                    </Link>
                  </h2>

                  <button
                    type="button"
                    onClick={() => setPayoutsOpen((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition"
                    style={{
                      borderColor: "rgba(58,63,75,0.85)",
                      backgroundColor: "rgba(255,255,255,0.04)",
                      color: "rgba(245,246,248,0.80)",
                    }}
                  >
                    <ChevronDown
                      className={cx(
                        "h-4 w-4 transition-transform",
                        payoutsOpen ? "rotate-0" : "-rotate-90"
                      )}
                    />
                    <span className="hidden sm:inline">
                      {payoutsOpen ? "Collapse" : "Expand"}
                    </span>
                  </button>
                </div>

                <p
                  className="mt-1 text-xs"
                  style={{ color: "var(--color-muted)" }}
                >
                  Search payouts by employee or address. In{" "}
                  <span style={{ color: "rgba(207,174,93,0.9)" }}>Pending</span>
                  , select payouts to generate a stub and mark them paid.
                </p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            {/* Row 1: Search + primary action (no overlap; wraps cleanly) */}
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
              {/* Search */}
              <div className="relative w-full min-w-0 sm:w-[320px] sm:flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/45" />
                <input
                  value={payoutSearch}
                  onChange={(e) => setPayoutSearch(e.target.value)}
                  placeholder="Search employee or address…"
                  className="w-full rounded-xl border pl-9 pr-3 py-2 text-sm outline-none focus:ring-2"
                  style={{
                    borderColor: "rgba(58,63,75,0.85)",
                    backgroundColor: "rgba(11,14,20,0.45)",
                    color: "rgba(245,246,248,0.92)",
                  }}
                />
              </div>

              {/* Day-rate payout */}
              <button
                type="button"
                onClick={onOpenPayTechnician}
                className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition hover:opacity-95 sm:self-auto"
                style={{
                  backgroundColor: "rgba(207,174,93,0.95)",
                  color: "#0b0e14",
                }}
              >
                <Wrench className="h-4 w-4" />
                <span className="hidden sm:inline">Day-rate payout</span>
                <span className="sm:hidden">Day-rate</span>
              </button>
            </div>

            {/* Row 2: Filters (scrollable on mobile, right-aligned on desktop) */}
            <div className="mt-1 flex w-full items-center sm:mt-0 sm:justify-end">
              <div className="flex w-full gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:w-auto">
                <Pill
                  active={payoutFilter === "all"}
                  onClick={() => setPayoutFilter("all")}
                >
                  All
                </Pill>
                <Pill
                  active={payoutFilter === "pending"}
                  onClick={() => setPayoutFilter("pending")}
                >
                  Pending
                </Pill>
                <Pill
                  active={payoutFilter === "paid"}
                  onClick={() => setPayoutFilter("paid")}
                >
                  Paid
                </Pill>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible content */}
      {payoutsOpen && (
        <div className="relative">
          {/* scrolling list area */}
          <div className="relative overflow-auto section-scroll max-h-[520px] px-4 sm:px-6 py-4">
            <div className="space-y-3">
              {/* Create stub CTA (pending only, single employee only) */}
              {payoutFilter === "pending" && selectedPayoutIds.length > 0 && (
                <div
                  className="sticky top-0 z-20 rounded-2xl border px-4 py-3 backdrop-blur"
                  style={{
                    borderColor: "rgba(58,63,75,0.75)",
                    backgroundColor: "rgba(11,14,20,0.75)",
                  }}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs">
                      {selectedEmployeeIds.length > 1 ? (
                        <span className="text-red-300">
                          Please select payouts for a single employee to create
                          a stub.
                        </span>
                      ) : (
                        <span className="text-white/60">
                          Selected{" "}
                          <span style={{ color: "rgba(207,174,93,0.95)" }}>
                            {selectedPayoutIds.length}
                          </span>{" "}
                          payout{selectedPayoutIds.length === 1 ? "" : "s"}.
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {canCreateStub && (
                        <button
                          type="button"
                          onClick={() => setStubOpen(true)}
                          className="rounded-xl bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 border border-emerald-400/25 hover:bg-emerald-500/25 transition"
                        >
                          Create stub ({selectedPayoutIds.length})
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={clearSelectedPayouts}
                        className="rounded-xl border px-3 py-2 text-xs font-semibold transition"
                        style={{
                          borderColor: "rgba(58,63,75,0.85)",
                          backgroundColor: "rgba(255,255,255,0.04)",
                          color: "rgba(245,246,248,0.85)",
                        }}
                      >
                        Clear all
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* States */}
              {payoutsLoading && (
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  Loading payouts…
                </p>
              )}
              {payoutsError && (
                <p className="text-sm text-red-300">{payoutsError}</p>
              )}
              {!payoutsLoading &&
                !payoutsError &&
                pagedPayouts.length === 0 && (
                  <div
                    className="rounded-2xl border p-4"
                    style={{
                      borderColor: "rgba(58,63,75,0.75)",
                      backgroundColor: "rgba(11,14,20,0.35)",
                      color: "var(--color-muted)",
                    }}
                  >
                    No payouts match the current filters.
                  </div>
                )}

              {/* List */}
              {!payoutsLoading && !payoutsError && pagedPayouts.length > 0 && (
                <motion.ul
                  className="divide-y rounded-2xl border overflow-hidden"
                  style={{
                    borderColor: "rgba(58,63,75,0.75)",
                    backgroundColor: "rgba(11,14,20,0.35)",
                  }}
                  variants={staggerParent}
                  initial="initial"
                  animate="animate"
                >
                  {pagedPayouts.map((p) => {
                    const a = addr((p as any).jobAddressSnapshot as any);
                    const employeeName = payoutEmployeeName(p);
                    const isPending = !p.paidAt;
                    const isSelected = selectedPayoutIds.includes(p.id);
                    const amountCents = (p as any).amountCents ?? 0;
                    const jobId = (p as any).jobId as string | undefined;

                    const sqft = p.sqft;
                    const ratePerSqFt = p.ratePerSqFt;
                    const category = p.category;

                    const hasSqft =
                      typeof sqft === "number" && !Number.isNaN(sqft);
                    const hasRate =
                      typeof ratePerSqFt === "number" &&
                      !Number.isNaN(ratePerSqFt);

                    const categoryLabel =
                      category === "shingles"
                        ? "Shingles labor"
                        : category === "felt"
                        ? "Felt labor"
                        : category === "technician"
                        ? "Technician"
                        : undefined;

                    return (
                      <motion.li
                        key={p.id}
                        variants={item}
                        className="px-4 py-3"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          {/* Left */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <User className="h-4 w-4 text-white/45 shrink-0" />
                              <div className="text-sm font-semibold text-white truncate">
                                {employeeName || "Unknown employee"}
                              </div>

                              <span
                                className="ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                style={{
                                  borderColor: isPending
                                    ? "rgba(207,174,93,0.28)"
                                    : "rgba(16,185,129,0.28)",
                                  backgroundColor: isPending
                                    ? "rgba(207,174,93,0.10)"
                                    : "rgba(16,185,129,0.10)",
                                  color: isPending
                                    ? "rgba(207,174,93,0.95)"
                                    : "rgba(16,185,129,0.95)",
                                }}
                              >
                                {isPending ? "Pending" : "Paid"}
                              </span>
                            </div>

                            <div className="mt-1 flex items-start gap-2 text-xs text-white/60 min-w-0">
                              <MapPin className="h-3.5 w-3.5 mt-[1px] shrink-0 text-white/35" />
                              <div className="min-w-0">
                                <div className="truncate">
                                  {a.display || "—"}
                                </div>
                                {(a.city || a.state || a.zip) && (
                                  <div className="text-[11px] text-white/45">
                                    {[a.city, a.state, a.zip]
                                      .filter(Boolean)
                                      .join(", ")}
                                  </div>
                                )}
                              </div>
                            </div>

                            {(categoryLabel || hasSqft || hasRate) && (
                              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/55">
                                {categoryLabel && (
                                  <span
                                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                    style={{
                                      borderColor: "rgba(58,63,75,0.85)",
                                      backgroundColor: "rgba(255,255,255,0.04)",
                                      color: "rgba(245,246,248,0.80)",
                                    }}
                                  >
                                    {categoryLabel}
                                  </span>
                                )}
                                {hasSqft && (
                                  <span>{sqft!.toLocaleString()} sq ft</span>
                                )}
                                {hasSqft && hasRate && (
                                  <span className="text-white/30">•</span>
                                )}
                                {hasRate && (
                                  <span>
                                    @{" "}
                                    {ratePerSqFt!.toLocaleString(undefined, {
                                      style: "currency",
                                      currency: "USD",
                                    })}
                                    /sq ft
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="mt-2 text-[11px] text-white/45">
                              Created {fmtDateTime(p.createdAt)}{" "}
                              {p.paidAt
                                ? `• Paid ${fmtDateTime(p.paidAt)}`
                                : "• Pending"}
                            </div>
                          </div>

                          {/* Right */}
                          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                            <div
                              className="rounded-xl border px-3 py-2 text-right"
                              style={{
                                borderColor: "rgba(58,63,75,0.75)",
                                backgroundColor: "rgba(11,14,20,0.45)",
                              }}
                            >
                              <div className="text-[11px] text-white/45">
                                Amount
                              </div>
                              <div className="text-sm font-semibold text-white">
                                {money(amountCents)}
                              </div>
                            </div>

                            {jobId && (
                              <button
                                type="button"
                                onClick={() => onViewJob(jobId)}
                                className="rounded-xl border px-3 py-2 text-xs font-semibold transition"
                                style={{
                                  borderColor: "rgba(58,63,75,0.85)",
                                  backgroundColor: "rgba(255,255,255,0.04)",
                                  color: "rgba(245,246,248,0.85)",
                                }}
                              >
                                View Job
                              </button>
                            )}

                            {payoutFilter === "pending" && (
                              <label className="flex items-center gap-2 text-xs text-white/60 select-none">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border"
                                  style={{
                                    borderColor: "rgba(58,63,75,0.85)",
                                    accentColor: "var(--color-accent-gold)",
                                  }}
                                  checked={isSelected}
                                  onChange={() => togglePayoutSelected(p.id)}
                                />
                                Select
                              </label>
                            )}
                          </div>
                        </div>
                      </motion.li>
                    );
                  })}
                </motion.ul>
              )}

              <div aria-hidden className="h-14" />
            </div>
          </div>

          {/* Sticky pagination footer (always visible) */}
          {filteredPayoutsCount > 0 && (
            <div
              className="sticky bottom-0 z-30 flex items-center justify-between gap-3 border-t px-4 sm:px-6 py-3 backdrop-blur"
              style={{
                borderColor: "rgba(58,63,75,0.75)",
                backgroundColor: "rgba(11,14,20,0.88)",
              }}
            >
              <span className="text-xs text-white/55">
                Showing <span className="text-white/80">{showingFrom}</span> –{" "}
                <span className="text-white/80">{showingTo}</span> of{" "}
                <span className="text-white/80">{filteredPayoutsCount}</span>
              </span>

              <div className="flex items-center gap-2 text-xs text-white/65">
                <button
                  type="button"
                  disabled={payoutsPage === 1}
                  onClick={() => setPayoutsPage((p) => Math.max(1, p - 1))}
                  className="rounded-xl border px-3 py-2 disabled:opacity-40 transition"
                  style={{
                    borderColor: "rgba(58,63,75,0.85)",
                    backgroundColor: "rgba(255,255,255,0.04)",
                    color: "rgba(245,246,248,0.85)",
                  }}
                >
                  Prev
                </button>

                <span className="hidden sm:inline">
                  Page <span className="text-white/85">{payoutsPage}</span> /{" "}
                  <span className="text-white/85">{payoutsTotalPages}</span>
                </span>

                <button
                  type="button"
                  disabled={payoutsPage === payoutsTotalPages}
                  onClick={() =>
                    setPayoutsPage((p) => Math.min(payoutsTotalPages, p + 1))
                  }
                  className="rounded-xl border px-3 py-2 disabled:opacity-40 transition"
                  style={{
                    borderColor: "rgba(58,63,75,0.85)",
                    backgroundColor: "rgba(255,255,255,0.04)",
                    color: "rgba(245,246,248,0.85)",
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.section>
  );
}
