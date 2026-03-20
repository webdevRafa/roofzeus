// src/pages/dashboard/DashboardJobsSection.tsx
import type { Dispatch, SetStateAction } from "react";
import type { Job, JobStatus, Employee } from "../../types/types";
import { Link } from "react-router-dom";
import {
  motion,
  AnimatePresence,
  type MotionProps,
  type Variants,
} from "framer-motion";
import { Search, Filter } from "lucide-react";
import CountUp from "react-countup";

type FsTimestampLike = { toDate: () => Date };

function isFsTimestamp(x: unknown): x is FsTimestampLike {
  return typeof (x as FsTimestampLike)?.toDate === "function";
}

function toMillis(v: unknown): number | null {
  if (!v) return null;
  if (typeof v === "number") return v;
  if (v instanceof Date) return v.getTime();
  if (isFsTimestamp(v)) return v.toDate().getTime();
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  return null;
}

function fmtDateTime(v: unknown): string {
  const ms = toMillis(v);
  if (ms == null) return "—";
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtDateOnly(v: unknown): string {
  const ms = toMillis(v);
  if (ms == null) return "—";
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
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

// ---- Motion helpers ----
const EASE = [0.16, 1, 0.3, 1] as const;

const fadeUp = (delay = 0): MotionProps => ({
  initial: { opacity: 0, y: 12, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.5, ease: EASE, delay },
});

const staggerParent: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.02 },
  },
};

const item: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};

// ---------- Status pill (dark theme) ----------
function statusClasses(status: JobStatus) {
  switch (status) {
    case "active":
      return "border-[var(--color-accent-gold)]/30 bg-[var(--color-accent-gold)]/10 text-[var(--color-accent-gold)]";
    case "pending":
      return "border-none  text-[rgb(var(--pill-warning-rgb))]";
    case "invoiced":
      return "border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-surface-rgb)/0.55)] text-[rgb(var(--color-text-rgb)/0.72)]";

    case "paid":
      return "border-[rgb(var(--pill-success-rgb)/0.35)] bg-[rgb(var(--pill-success-rgb)/0.14)] text-[rgb(var(--pill-success-rgb))]";
    case "completed":
      return "border-[rgb(var(--pill-success-rgb)/0.35)] bg-[rgb(var(--pill-success-rgb)/0.14)] text-[rgb(var(--pill-success-rgb))]";
    case "closed":
      return "border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] text-[rgb(var(--color-text-rgb)/0.62)]";
    case "archived":
      return "border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] text-[rgb(var(--color-text-rgb)/0.62)]";
    case "draft":
    default:
      return "border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] text-[rgb(var(--color-text-rgb)/0.62)]";
  }
}

function CountMoney({ cents }: { cents: number }) {
  const dollars = (cents ?? 0) / 100;
  return (
    <CountUp
      end={dollars}
      decimals={2}
      prefix="$"
      separator=","
      duration={0.45}
    />
  );
}

type StatusFilter = "all" | JobStatus;
type DatePreset = "custom" | "last7" | "thisMonth" | "ytd";

export interface DashboardJobsSectionProps {
  jobsOpen: boolean;
  setJobsOpen: Dispatch<SetStateAction<boolean>>;

  // search
  showSearch: boolean;
  setShowSearch: Dispatch<SetStateAction<boolean>>;
  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;

  // date filters
  showFilters: boolean;
  setShowFilters: Dispatch<SetStateAction<boolean>>;
  hasActiveDateFilter: boolean;
  rangeLabel: string | null;
  startDate: string;
  endDate: string;
  setDatePreset: Dispatch<SetStateAction<DatePreset>>;
  setStartDate: Dispatch<SetStateAction<string>>;
  setEndDate: Dispatch<SetStateAction<string>>;
  applyPreset: (p: DatePreset) => void;

  employees: Employee[];
  assignedEmployeeIds: string[];
  setAssignedEmployeeIds: Dispatch<SetStateAction<string[]>>;

  // status filter
  filters: StatusFilter[];
  statusFilter: StatusFilter;
  setStatusFilter: Dispatch<SetStateAction<StatusFilter>>;

  newFeltDate: string;
  setNewFeltDate: (value: string) => void;
  newShinglesDate: string;
  setNewShinglesDate: (value: string) => void;
  newPunchDate: string;
  setNewPunchDate: (value: string) => void;

  // create job form
  openForm: boolean;
  setOpenForm: Dispatch<SetStateAction<boolean>>;
  address: string;
  setAddress: Dispatch<SetStateAction<string>>;
  createJob: () => Promise<void>;
  loading: boolean;
  error: string | null;

  // jobs data + pagination
  filteredJobs: Job[];
  pagedJobs: Job[];
  jobsPage: number;
  jobsTotalPages: number;
  JOBS_PER_PAGE: number;
  setJobsPage: Dispatch<SetStateAction<number>>;
  totalNet: number;
}

// ---- Pipeline note: derived (non-breaking, read-only) ----
function pipelineNote(job: Job): string {
  const feltSch = toMillis((job as any).feltScheduledFor ?? null);
  const feltDone = toMillis((job as any).feltCompletedAt ?? null);
  const shinglesSch = toMillis((job as any).shinglesScheduledFor ?? null);
  const shinglesDone = toMillis((job as any).shinglesCompletedAt ?? null);
  const punchSch = toMillis((job as any).punchScheduledFor ?? null);

  if (job.status === "paid") return "Paid • stub created";
  if (job.status === "invoiced") return "Invoice sent • awaiting payment";
  if (punchSch) return `Punch scheduled • ${fmtDateOnly(punchSch)}`;

  // Production stage
  if (shinglesDone) return "Shingles completed • ready for punch";
  if (shinglesSch) return `Shingles scheduled • ${fmtDateOnly(shinglesSch)}`;
  if (feltDone) return "Dry-in completed • awaiting shingles";
  if (feltSch) return `Dry-in scheduled • ${fmtDateOnly(feltSch)}`;

  if (job.status === "pending") return "Pending • needs attention";
  if (job.status === "active") return "Active • in progress";
  return "In pipeline";
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function DashboardJobsSection({
  jobsOpen,

  showSearch,
  setShowSearch,
  searchTerm,
  setSearchTerm,

  showFilters,
  setShowFilters,
  hasActiveDateFilter,
  rangeLabel,
  setDatePreset,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  applyPreset,

  employees,
  assignedEmployeeIds,
  setAssignedEmployeeIds,

  filters,
  statusFilter,
  setStatusFilter,

  newFeltDate,
  setNewFeltDate,
  newShinglesDate,
  setNewShinglesDate,
  newPunchDate,
  setNewPunchDate,
  openForm,
  setOpenForm,
  address,
  setAddress,
  createJob,
  loading,
  error,

  filteredJobs,
  pagedJobs,
  jobsPage,
  jobsTotalPages,
  setJobsPage,
  JOBS_PER_PAGE,

  totalNet,
}: DashboardJobsSectionProps) {
  return (
    <>
      <section className=" hover:shadow-md overflow-hidden  mt-5">
        {/* Header */}
        <motion.header
          className="select-none border-b border-[var(--color-border)] px-4 sm:px-6 py-1.5 relative z-50"
          {...fadeUp(0)}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between  ">
            <div className="w-full flex justify-between">
              {/* Controls row */}
              <div className="flex gap-3  sm:items-center">
                {/* Search toggle */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSearch((v) => !v)}
                    className="cursor-pointer hover:shadow-md inline-flex items-center justify-center rounded-xl  px-3 py-2 text-[10px] md:text-[12px] font-semibold text-[rgb(var(--color-text-rgb)/0.78)]  transition"
                    title="Search addresses"
                    aria-label="Search addresses"
                  >
                    <Search size={18} className="mr-2" />
                    <span>Search</span>
                  </button>

                  <AnimatePresence initial={false}>
                    {showSearch && (
                      <motion.div
                        {...fadeUp(0.02)}
                        className="mt-2 sm:absolute sm:left-0 sm:mt-2 w-full sm:w-96 shadow-lg  bg-[var(--color-background)] backdrop-blur px-4 py-5  z-60 relative "
                      >
                        <input
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Search by address…"
                          className="w-full  border border-[rgb(var(--color-border-rgb)/0.05)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-2 text-sm text-[rgb(var(--color-text-rgb)/0.92)] outline-none focus:ring-2 "
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Date filter toggle */}
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  className=" cursor-pointer hover:shadow-md inline-flex items-center justify-center   text-[10px] md:text-[12px] font-semibold text-[rgb(var(--color-text-rgb)/0.78)] transition"
                  title="Filter by last updated date"
                >
                  <Filter size={16} className="mr-2" />
                  <span>
                    {hasActiveDateFilter ? "Edit date range" : "Date filters"}
                  </span>
                </button>
              </div>
              {/* Right chips + primary action */}
              <div className="flex flex-wrap items-center justify-end gap-2 text-sm md:text-md ">
                {hasActiveDateFilter ? (
                  <span className="inline-flex items-center   px-3 py-2 text-[var(--color-text-rgb)]">
                    Date: {rangeLabel || "Custom range"}
                  </span>
                ) : (
                  <span className="inline-flex items-center   px-3 py-2 text-[var(--color-text-rgb)]">
                    Date: All time
                  </span>
                )}

                <span className="inline-flex items-center  px-3 py-2 text-[var(--color-text-rgb)]">
                  Status:{" "}
                  <span className="ml-1 font-semibold text-[var(--color-text-rgb)]">
                    {statusFilter === "all" ? "All" : statusFilter}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </motion.header>

        {/* Create Job modal */}
        <AnimatePresence>
          {openForm && (
            <motion.div
              className="fixed inset-0 z-90 flex items-center justify-center bg-black/60 px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-full max-w-2xl  border border-[var(--color-border)] bg-[var(--color-card)] backdrop-blur p-5 lg:py-15 lg:px-5 shadow-[0_30px_90px_rgba(0,0,0,0.6)]"
                {...fadeUp(0.02)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--color-text)]">
                      Create new job
                    </h3>
                  </div>
                </div>

                <div className="mt-6 space-y-7">
                  {/* Address */}
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.55)]">
                      Job address <span className="text-red-300">*</span>
                    </label>
                    <input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="123 Main St, San Antonio, TX"
                      className="w-full rounded-lg border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-2 text-sm text-[rgb(var(--color-text-rgb)/0.92)] outline-none focus:ring-2 focus:ring-[var(--color-accent-gold)]/40"
                    />
                  </div>

                  {/* Assign workers */}
                  <div>
                    <div className="text-sm font-semibold text-[var(--color-text)]">
                      Assign workers{" "}
                      <span className="text-[rgb(var(--color-text-rgb)/0.55)]">
                        (optional)
                      </span>
                    </div>

                    <div className="mt-2 max-h-40 overflow-auto rounded-xl border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] p-2">
                      {employees.length === 0 ? (
                        <div className="text-sm text-[rgb(var(--color-text-rgb)/0.62)]">
                          No active members found.
                        </div>
                      ) : (
                        employees.map((emp) => {
                          const checked = assignedEmployeeIds.includes(emp.id);
                          return (
                            <label
                              key={emp.id}
                              className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-[rgb(var(--color-surface-rgb)/0.55)]"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-[rgb(var(--color-text-rgb)/0.90)]">
                                  {emp.name}
                                </div>
                                <div className="truncate text-xs text-[rgb(var(--color-text-rgb)/0.55)]">
                                  {emp.role ?? "crew"}
                                </div>
                              </div>

                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setAssignedEmployeeIds((prev) =>
                                    checked
                                      ? prev.filter((id) => id !== emp.id)
                                      : [...prev, emp.id]
                                  );
                                }}
                                className="h-4 w-4 accent-[var(--color-accent-gold)]"
                              />
                            </label>
                          );
                        })
                      )}
                    </div>

                    {assignedEmployeeIds.length > 0 && (
                      <div className="mt-2 text-xs text-[rgb(var(--color-text-rgb)/0.62)]">
                        Assigned: {assignedEmployeeIds.length}
                        <button
                          type="button"
                          onClick={() => setAssignedEmployeeIds([])}
                          className="ml-2 underline hover:opacity-80"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Schedule fields */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.55)]">
                        Schedule felt (optional)
                      </label>
                      <input
                        type="date"
                        value={newFeltDate}
                        onChange={(e) => setNewFeltDate(e.target.value)}
                        className="w-full rounded-lg border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-2 py-2 text-xs text-[rgb(var(--color-text-rgb)/0.92)]"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.55)]">
                        Schedule shingles (optional)
                      </label>
                      <input
                        type="date"
                        value={newShinglesDate}
                        onChange={(e) => setNewShinglesDate(e.target.value)}
                        className="w-full rounded-lg border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-2 py-2 text-xs text-[rgb(var(--color-text-rgb)/0.92)]"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.55)]">
                        Schedule punch (optional)
                      </label>
                      <input
                        type="date"
                        value={newPunchDate}
                        onChange={(e) => setNewPunchDate(e.target.value)}
                        className="w-full rounded-lg border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-2 py-2 text-xs text-[rgb(var(--color-text-rgb)/0.92)]"
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="mt-3 text-xs text-red-300">{error}</div>
                )}

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenForm(false);
                      setAddress("");
                      setAssignedEmployeeIds([]);
                      setNewFeltDate("");
                      setNewShinglesDate("");
                      setNewPunchDate("");
                    }}
                    className=" px-3 py-2 text-xs font-semibold text-[var(--color-text)]/70 hover:text-[var(--color-text)] cursor-pointer transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void createJob()}
                    disabled={loading}
                    className={[
                      " px-4 py-2 text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
                      " text-[var(--color-text)]/70 hover:text-[var(--color-text)]",
                      "active:translate-y-[1px]",
                    ].join(" ")}
                  >
                    {loading ? "Creating…" : "Create job"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Date range filters */}
        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.section
              id="date-filters"
              className="bg-[var(--color-card)]  px-4 sm:px-6 py-4 relative z-40"
              {...fadeUp(0.06)}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-xs md:text-sm font-semibold text-[var(--color-text)]">
                    Filter Dates
                  </h3>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex items-end gap-2">
                    <div className="flex flex-col">
                      <label className="text-[10px] uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.55)]">
                        Start
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setDatePreset("custom");
                          setStartDate(e.target.value);
                        }}
                        className="rounded-lg border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-2 py-2 text-xs text-[rgb(var(--color-text-rgb)/0.92)]"
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-[10px] uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.55)]">
                        End
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                          setDatePreset("custom");
                          setEndDate(e.target.value);
                        }}
                        className="rounded-lg border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-2 py-2 text-xs text-[rgb(var(--color-text-rgb)/0.92)]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => applyPreset("last7")}
                      className="rounded-full border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] hover:bg-[rgb(var(--color-surface-rgb)/0.75)] px-3 py-2 text-xs font-semibold text-[rgb(var(--color-text-rgb)/0.72)] transition"
                    >
                      Last 7 days
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("thisMonth")}
                      className="rounded-full border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] hover:bg-[rgb(var(--color-surface-rgb)/0.75)] px-3 py-2 text-xs font-semibold text-[rgb(var(--color-text-rgb)/0.72)] transition"
                    >
                      This month
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("ytd")}
                      className="rounded-full border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] hover:bg-[rgb(var(--color-surface-rgb)/0.75)] px-3 py-2 text-xs font-semibold text-[rgb(var(--color-text-rgb)/0.72)] transition"
                    >
                      Year to date
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDatePreset("custom");
                        setStartDate("");
                        setEndDate("");
                      }}
                      className="rounded-full border border-red-300/20 bg-red-300/10 hover:bg-red-300/15 px-3 py-2 text-xs font-semibold text-red-200 transition"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Content */}
        {jobsOpen && (
          <div className="px-4 sm:px-6 py-5">
            {/* Status Filters row (only when expanded) */}
            {jobsOpen && (
              <div className="my-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {filters.map((f) => {
                  const active = statusFilter === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setStatusFilter(f)}
                      className={cx(
                        "whitespace-nowrap cursor-pointer   px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition hover:shadow-md",
                        active
                          ? " text-[var(--color-text)]"
                          : " text-[var(--color-text)]/70 hover:text-[var(--color-text)]"
                      )}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="grid min-w-0 gap-4 xl:grid-cols-12 xl:items-start">
              {/* Main list/table */}
              <motion.div {...fadeUp(0.08)} className="xl:col-span-9 min-w-0">
                <div className=" overflow-hidden">
                  {/* Mobile cards */}
                  <div className="grid gap-2 p-2 md:hidden">
                    {pagedJobs.map((job) => {
                      const a = addr(job.address);
                      const net = job.computed?.netProfitCents ?? 0;

                      return (
                        <motion.div
                          key={job.id}
                          variants={item}
                          initial="initial"
                          animate="animate"
                          whileHover={{
                            y: -1,
                            transition: { duration: 0.2, ease: EASE },
                          }}
                          className="rounded-xl border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] hover:bg-[rgb(var(--color-surface-rgb)/0.55)] transition px-3 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="truncate text-sm font-semibold text-[rgb(var(--color-text-rgb)/0.92)]">
                                  {a.display || "—"}
                                </div>
                                <span
                                  className={cx(
                                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase",
                                    statusClasses(job.status)
                                  )}
                                >
                                  {job.status}
                                </span>
                              </div>

                              <div className="mt-1 text-[12px] text-[rgb(var(--color-text-rgb)/0.55)] truncate">
                                {pipelineNote(job)}
                              </div>
                            </div>

                            <div className="shrink-0 text-right">
                              <div className="text-[11px] text-[rgb(var(--color-text-rgb)/0.45)]">
                                Net
                              </div>
                              <div
                                className={cx(
                                  "text-sm font-semibold",
                                  net >= 0
                                    ? "text-[rgb(var(--pill-success-rgb))]"
                                    : "text-[rgb(var(--pill-danger-rgb))]"
                                )}
                              >
                                <CountMoney cents={net} />
                              </div>
                            </div>
                          </div>

                          <div className="mt-2 flex items-center justify-between">
                            <div className="text-[11px] text-[rgb(var(--color-text-rgb)/0.45)]">
                              Updated {fmtDateTime(job.updatedAt)}
                            </div>

                            <Link
                              to={`/job/${job.id}`}
                              className="inline-flex items-center justify-center rounded-lg border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] hover:bg-[rgb(var(--color-surface-rgb)/0.75)] px-3 py-1 text-[11px] font-semibold text-[rgb(var(--color-text-rgb)/0.72)] transition"
                            >
                              View job
                            </Link>
                          </div>
                        </motion.div>
                      );
                    })}

                    {pagedJobs.length === 0 && (
                      <div className="px-4 py-6 text-center text-[12px] text-[rgb(var(--color-text-rgb)/0.55)]">
                        No jobs match the current filters.
                      </div>
                    )}

                    {/* Mobile pagination */}
                    {filteredJobs.length > 0 && (
                      <div className="mt-2 flex items-center justify-between text-xs text-[rgb(var(--color-text-rgb)/0.55)]">
                        <span>
                          {(jobsPage - 1) * JOBS_PER_PAGE + 1} –{" "}
                          {Math.min(
                            jobsPage * JOBS_PER_PAGE,
                            filteredJobs.length
                          )}{" "}
                          of {filteredJobs.length}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={jobsPage === 1}
                            onClick={() =>
                              setJobsPage((p) => Math.max(1, p - 1))
                            }
                            className="rounded-full border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-1 disabled:opacity-40"
                          >
                            Prev
                          </button>
                          <span>
                            {jobsPage}/{jobsTotalPages}
                          </span>
                          <button
                            type="button"
                            disabled={jobsPage === jobsTotalPages}
                            onClick={() =>
                              setJobsPage((p) =>
                                Math.min(jobsTotalPages, p + 1)
                              )
                            }
                            className="rounded-full border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-1 disabled:opacity-40"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Desktop table */}
                  <motion.div
                    className="hidden md:block"
                    variants={staggerParent}
                    initial="initial"
                    animate="animate"
                  >
                    <div className="relative overflow-auto section-scroll">
                      <table className="w-full table-fixed text-xs border-separate border-spacing-0">
                        <thead className="sticky top-0 z-30 bg-[var(--color-card)] backdrop-blur text-[11px] uppercase tracking-wide text-[var(--color-text)]">
                          <tr>
                            <th className="text-left px-4 py-3">Job</th>
                            <th className="text-left px-4 py-3 whitespace-nowrap">
                              Status
                            </th>
                            <th className="text-left px-4 py-3">Note</th>
                            <th className="text-right px-4 py-3">Net</th>
                            <th className="text-left px-4 py-3 whitespace-nowrap">
                              Last Updated
                            </th>
                            <th className="text-right px-4 py-3 whitespace-nowrap">
                              Actions
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {pagedJobs.map((job, idx) => {
                            const a = addr(job.address);
                            const net = job.computed?.netProfitCents ?? 0;

                            return (
                              <motion.tr
                                key={job.id}
                                variants={item}
                                className={cx(
                                  "transition",
                                  idx % 2 === 0
                                    ? "bg-[rgb(var(--color-surface-rgb)/0.35)]"
                                    : "bg-transparent",
                                  "hover:bg-[var(--color-card)]/50"
                                )}
                              >
                                <td className="px-4 py-3">
                                  <div className="min-w-0">
                                    <div className="truncate max-w-[320px] font-semibold text-[rgb(var(--color-text-rgb)/0.92)]">
                                      <Link
                                        to={`/job/${job.id}`}
                                        className="hover:underline"
                                      >
                                        {a.display || "—"}
                                      </Link>
                                    </div>
                                    {(a.city || a.state || a.zip) && (
                                      <div className="text-sm md:text-xl text-[var(--color-text)]">
                                        {[a.city, a.state, a.zip]
                                          .filter(Boolean)
                                          .join(", ")}
                                      </div>
                                    )}
                                  </div>
                                </td>

                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span
                                    className={cx(
                                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase",
                                      statusClasses(job.status)
                                    )}
                                  >
                                    {job.status}
                                  </span>
                                </td>

                                <td className="px-4 py-3">
                                  <div className="text-[rgb(var(--color-text-rgb)/0.72)] text-[12px] truncate max-w-[320px]">
                                    {pipelineNote(job)}
                                  </div>
                                  <div className="text-[11px] text-[rgb(var(--color-text-rgb)/0.45)]">
                                    Created {fmtDateTime(job.createdAt)}
                                  </div>
                                </td>

                                <td className="px-4 py-3 text-right">
                                  <span
                                    className={cx(
                                      "font-semibold",
                                      net >= 0
                                        ? "text-[rgb(var(--pill-success-rgb))]"
                                        : "text-[rgb(var(--pill-danger-rgb))]"
                                    )}
                                  >
                                    <CountMoney cents={net} />
                                  </span>
                                </td>

                                <td className="px-4 py-3">
                                  <div className="text-[rgb(var(--color-text-rgb)/0.78)]">
                                    {fmtDateTime(job.updatedAt)}
                                  </div>
                                </td>

                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                  <Link
                                    to={`/job/${job.id}`}
                                    className="inline-flex items-center justify-center  border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] hover:bg-[rgb(var(--color-surface-rgb)/0.75)] px-3 py-1 text-[11px] font-semibold text-[rgb(var(--color-text-rgb)/0.72)] transition"
                                  >
                                    View job
                                  </Link>
                                </td>
                              </motion.tr>
                            );
                          })}

                          {pagedJobs.length === 0 && (
                            <tr>
                              <td
                                colSpan={6}
                                className="px-4 py-8 text-center text-[rgb(var(--color-text-rgb)/0.55)]"
                              >
                                No jobs match the current filters.
                              </td>
                            </tr>
                          )}
                        </tbody>

                        {/* Spacer so last row scrolls above sticky footer */}
                        <tbody aria-hidden>
                          <tr>
                            <td colSpan={6} className="h-12 p-0" />
                          </tr>
                        </tbody>
                      </table>

                      {/* Sticky pagination footer */}
                      {filteredJobs.length > 0 && (
                        <div className="sticky bottom-[-1px] z-30 flex items-center justify-between gap-3 border-t border-[var(--color-border)]/60 bg-[var(--color-card)] px-4 py-2  text-xs text-[rgb(var(--color-text-rgb)/0.55)]">
                          <span>
                            Showing {(jobsPage - 1) * JOBS_PER_PAGE + 1} –{" "}
                            {Math.min(
                              jobsPage * JOBS_PER_PAGE,
                              filteredJobs.length
                            )}{" "}
                            of {filteredJobs.length}
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={jobsPage === 1}
                              onClick={() =>
                                setJobsPage((p) => Math.max(1, p - 1))
                              }
                              className="rounded-full border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-1 disabled:opacity-40"
                            >
                              Prev
                            </button>
                            <span>
                              Page {jobsPage} / {jobsTotalPages}
                            </span>
                            <button
                              type="button"
                              disabled={jobsPage === jobsTotalPages}
                              onClick={() =>
                                setJobsPage((p) =>
                                  Math.min(jobsTotalPages, p + 1)
                                )
                              }
                              className="rounded-full border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-1 disabled:opacity-40"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>
              </motion.div>

              {/* Right rail: totals / quick stats */}
              <motion.aside
                {...fadeUp(0.12)}
                className="xl:col-span-3 min-w-0 w-full xl:justify-self-end"
              >
                <div className="bg-var(--color-background)] p-4">
                  <div className="text-sm md:text-lg uppercase tracking-wider text-[rgb(var(--color-text-rgb)/0.55)]">
                    Total net
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-[var(--color-text)]">
                    <CountMoney cents={totalNet} />
                  </div>
                  <div className="mt-1 text-[12px] text-[var(--color-accent-gold)]/70">
                    Across {filteredJobs.length} job
                    {filteredJobs.length === 1 ? "" : "s"}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="p-3 text-sm md:text-md">
                      <div className=" uppercase tracking-wider text-[rgb(var(--color-text-rgb)/0.55)]">
                        Showing
                      </div>
                      <div className="mt-1  font-semibold text-[var(--color-text)]">
                        {pagedJobs.length}
                      </div>
                      <div className="mt-1 text-[var(--color-text)] text-xs">
                        On this page
                      </div>
                    </div>

                    <div className="text-sm md:text-md p-3">
                      <div className="uppercase tracking-wider text-[var(--color-text)]">
                        Filter
                      </div>
                      <div className="mt-1 text-xs font-semibold text-[var(--color-text)]">
                        {statusFilter === "all" ? "All" : statusFilter}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.aside>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
