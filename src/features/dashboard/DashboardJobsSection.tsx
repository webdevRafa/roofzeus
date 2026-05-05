// src/pages/dashboard/DashboardJobsSection.tsx
import { useState, useMemo, type Dispatch, type SetStateAction } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import type { Job, JobStatus, Employee } from "../../types/types";
import { Link } from "react-router-dom";
import { db } from "../../firebase/firebaseConfig";
import { useOrg } from "../../contexts/OrgContext";
import {
  motion,
  AnimatePresence,
  type MotionProps,
  type Variants,
} from "framer-motion";
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
  if (typeof a === "string") {
    return {
      display: a,
      line1: a,
      city: "",
      state: "",
      zip: "",
      cityStateZip: "",
    };
  }

  const obj: Record<string, unknown> =
    (a as unknown as Record<string, unknown>) ?? {};

  const line1 =
    pickString(obj, [
      "line1",
      "street",
      "address1",
      "address",
      "line",
      "street1",
    ]) || pickString(obj, ["fullLine", "full", "formatted", "text", "label"]);

  const city = pickString(obj, ["city", "town"]);
  const state = pickString(obj, ["state", "region", "province"]);
  const zip = pickString(obj, ["zip", "postalCode", "postcode", "zipCode"]);

  const cityStateZip = [city, state].filter(Boolean).join(", ");
  const cityStateZipWithPostal = [cityStateZip, zip].filter(Boolean).join(" ");

  const display =
    pickString(obj, ["fullLine", "full", "formatted", "label", "text"]) ||
    [line1, cityStateZipWithPostal].filter(Boolean).join(", ");

  return {
    display,
    line1,
    city,
    state,
    zip,
    cityStateZip: cityStateZipWithPostal,
  };
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
      return "border-none text-[rgb(var(--pill-success-rgb))]";
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
type RoofStage = "dryIn" | "shingles" | "punch";

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
  datePreset: DatePreset;

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
  city: string;
  setCity: Dispatch<SetStateAction<string>>;
  state: string;
  setState: Dispatch<SetStateAction<string>>;
  zip: string;
  setZip: Dispatch<SetStateAction<string>>;
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

  // scheduling from table pills
  onOpenScheduleStage?: (job: Job, stage: RoofStage) => void;
}

function startOfTodayMs() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function stageLabel(stage: RoofStage) {
  if (stage === "dryIn") return "Dry in";
  if (stage === "shingles") return "Shingles";
  return "Punch";
}

function getStageData(job: Job, stage: RoofStage) {
  if (stage === "dryIn") {
    const scheduledMs = toMillis((job as any).feltScheduledFor ?? null);
    const completedMs = toMillis((job as any).feltCompletedAt ?? null);
    return { scheduledMs, completedMs };
  }

  if (stage === "shingles") {
    const scheduledMs = toMillis((job as any).shinglesScheduledFor ?? null);
    const completedMs = toMillis((job as any).shinglesCompletedAt ?? null);
    return { scheduledMs, completedMs };
  }

  const scheduledMs = toMillis((job as any).punchScheduledFor ?? null);
  const completedMs = toMillis((job as any).punchedAt ?? null);
  return { scheduledMs, completedMs };
}

function getStageState(job: Job, stage: RoofStage) {
  const { scheduledMs, completedMs } = getStageData(job, stage);

  if (completedMs != null) {
    return {
      label: "Completed",
      dateLabel: fmtDateOnly(completedMs),
      tone: "complete" as const,
      actionable: false,
    };
  }

  if (scheduledMs != null) {
    const isBehind = scheduledMs < startOfTodayMs();

    return {
      label: isBehind ? "Behind schedule" : "Scheduled",
      dateLabel: fmtDateOnly(scheduledMs),
      tone: isBehind ? ("behind" as const) : ("scheduled" as const),
      actionable: true,
    };
  }

  return {
    label: "Needs schedule",
    dateLabel: "No date set",
    tone: "needs" as const,
    actionable: true,
  };
}

function scheduledFieldForStage(stage: RoofStage) {
  if (stage === "dryIn") return "feltScheduledFor";
  if (stage === "shingles") return "shinglesScheduledFor";
  return "punchScheduledFor";
}

function ymdFromUnknown(value: unknown): string {
  const ms = toMillis(value);
  if (ms == null) return "";

  const d = new Date(ms);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function singleDateToDate(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function stagePillClasses(tone: "complete" | "scheduled" | "behind" | "needs") {
  if (tone === "complete") {
    return "border-[rgb(var(--pill-success-rgb)/0.24)] bg-[rgb(var(--pill-success-rgb)/0.10)] text-[rgb(var(--pill-success-rgb)/0.92)]";
  }

  if (tone === "behind") {
    return "border-red-400/30 bg-red-500/10 text-red-300 shadow-[0_0_0_1px_rgba(248,113,113,0.08)]";
  }

  if (tone === "needs") {
    return "border-[rgb(var(--pill-warning-rgb)/0.36)] bg-[rgb(var(--pill-warning-rgb)/0.14)] text-[rgb(var(--pill-warning-rgb))] shadow-[0_0_0_1px_rgb(var(--pill-warning-rgb)/0.08)]";
  }

  return "border-[rgb(var(--color-border-rgb)/0.28)] bg-[rgb(var(--color-surface-rgb)/0.34)] text-[rgb(var(--color-text-rgb)/0.68)]";
}

function StagePill({
  job,
  stage,
  onOpenScheduleStage,
  compact = false,
}: {
  job: Job;
  stage: RoofStage;
  onOpenScheduleStage?: (job: Job, stage: RoofStage) => void;
  compact?: boolean;
}) {
  const state = getStageState(job, stage);
  const canClick = state.actionable && !!onOpenScheduleStage;

  const defaultLabel =
    state.tone === "behind"
      ? "Behind"
      : state.tone === "needs"
      ? "Needs schedule"
      : state.label;

  const hoverLabel = state.tone === "needs" ? "Schedule" : "Reschedule";

  return (
    <div className="min-w-0">
      <button
        type="button"
        disabled={!canClick}
        onClick={() => onOpenScheduleStage?.(job, stage)}
        title={
          canClick
            ? `${hoverLabel} ${stageLabel(stage)}`
            : `${stageLabel(stage)} ${state.label}`
        }
        className={cx(
          "group inline-flex justify-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition",
          state.tone === "needs" ? "w-[104px]" : "w-[82px]",
          compact && "w-full min-w-0",
          stagePillClasses(state.tone),
          canClick && state.tone === "scheduled"
            ? "cursor-pointer hover:border-[var(--color-accent-gold)]/35 hover:bg-[var(--color-accent-gold)]/12 hover:text-[var(--color-accent-gold)] hover:shadow-[0_0_0_1px_rgb(var(--color-primary-rgb)/0.10)]"
            : "",
          canClick && state.tone === "behind"
            ? "cursor-pointer hover:border-[rgb(var(--color-border-rgb)/0.28)] hover:bg-[rgb(var(--color-text-rgb)/0.06)] hover:text-[var(--color-text)] hover:shadow-[0_0_0_2px_rgb(var(--color-text-rgb)/0.08)]"
            : "",
          canClick && state.tone === "needs"
            ? "cursor-pointer hover:bg-[rgb(var(--pill-warning-rgb)/0.20)] hover:shadow-[0_0_0_2px_rgb(var(--pill-warning-rgb)/0.10)]"
            : "",
          !canClick ? "cursor-default" : ""
        )}
      >
        <span className={canClick ? "group-hover:hidden" : ""}>
          {defaultLabel}
        </span>

        {canClick && (
          <span className="hidden group-hover:inline">{hoverLabel}</span>
        )}
      </button>

      <div
        className={cx(
          "mt-1 truncate text-[11px]",
          state.tone === "behind"
            ? "font-medium text-red-300/80"
            : state.tone === "needs"
            ? "font-medium text-[rgb(var(--pill-warning-rgb)/0.78)]"
            : "text-[rgb(var(--color-text-rgb)/0.56)]"
        )}
      >
        {state.tone === "needs" ? "Not set" : state.dateLabel}
      </div>
    </div>
  );
}
function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
const STATE_OPTIONS = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

export function DashboardJobsSection({
  jobsOpen,

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
  city,
  setCity,
  state,
  setState,
  zip,
  setZip,
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
  onOpenScheduleStage,
}: DashboardJobsSectionProps) {
  const { orgId } = useOrg();

  const [localScheduleModal, setLocalScheduleModal] = useState<{
    job: Job;
    stage: RoofStage;
  } | null>(null);
  const [localScheduleDate, setLocalScheduleDate] = useState("");
  const [localScheduleSaving, setLocalScheduleSaving] = useState(false);

  function openStageSchedule(job: Job, stage: RoofStage) {
    if (onOpenScheduleStage) {
      onOpenScheduleStage(job, stage);
      return;
    }

    const existingDate = ymdFromUnknown(
      (job as any)[scheduledFieldForStage(stage)] ?? null
    );

    setLocalScheduleModal({ job, stage });
    setLocalScheduleDate(existingDate || ymdFromUnknown(new Date()));
  }

  function closeLocalScheduleModal() {
    if (localScheduleSaving) return;
    setLocalScheduleModal(null);
    setLocalScheduleDate("");
  }

  async function saveLocalScheduleDate() {
    if (!localScheduleModal || !localScheduleDate) return;

    if (!orgId) {
      alert("No organization selected. Please refresh and try again.");
      return;
    }

    try {
      setLocalScheduleSaving(true);

      await setDoc(
        doc(db, "organizations", orgId, "jobs", localScheduleModal.job.id),
        {
          [scheduledFieldForStage(localScheduleModal.stage)]:
            singleDateToDate(localScheduleDate),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setLocalScheduleModal(null);
      setLocalScheduleDate("");
    } catch (error) {
      console.error("Failed to save scheduled date", error);
      alert("Failed to save scheduled date. Please try again.");
    } finally {
      setLocalScheduleSaving(false);
    }
  }

  // Local state for the employee search term.
  const [employeeSearch, setEmployeeSearch] = useState("");

  // Memoized list of employees filtered by name or role.
  const filteredEmployeesList = useMemo(() => {
    const term = employeeSearch.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((emp) => {
      const name = emp.name?.toLowerCase() ?? "";
      const role = (emp.role ?? "").toLowerCase();
      return name.includes(term) || role.includes(term);
    });
  }, [employees, employeeSearch]);

  const assignedEmployees = employees.filter((e) =>
    assignedEmployeeIds.includes(e.id)
  );

  const visible = assignedEmployees.slice(0, 2);
  const remaining = assignedEmployees.length - visible.length;

  return (
    <>
      <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]/60 hover:shadow-md">
        {/* Create Job modal */}
        <AnimatePresence>
          {openForm && (
            <motion.div
              className="fixed inset-x-0 bottom-0 top-[72px] z-[120] flex justify-center overflow-y-auto bg-black/35 backdrop-blur-xs px-3 pt-3 pb-4 sm:top-[76px] sm:px-4 sm:pt-6 sm:pb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-full max-w-2xl self-start sm:self-start max-h-[calc(100dvh-72px-1rem)] sm:max-h-[calc(100dvh-76px-3rem)] overflow-y-auto [overscroll-behavior:contain] rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] backdrop-blur p-4 sm:p-5 lg:px-5 lg:py-8 shadow-[0_30px_90px_rgba(0,0,0,0.6)]"
                {...fadeUp(0.02)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg uppercase font-poppins font-semibold text-[var(--color-text)]">
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
                      placeholder="123 Main St"
                      className="w-full  border border-[rgb(var(--color-border-rgb)/0.14)] bg-[var(--color-card-hover))] px-3 py-2 text-sm text-[rgb(var(--color-text-rgb)/0.92)] outline-none focus:ring-2 focus:ring-[var(--color-accent-gold)]/40"
                    />

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.55)]">
                          City
                        </label>
                        <input
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="San Antonio"
                          className="w-full  border border-[rgb(var(--color-border-rgb)/0.14)] bg-[var(--color-card-hover))] px-3 py-2 text-sm text-[rgb(var(--color-text-rgb)/0.92)] outline-none focus:ring-2 focus:ring-[var(--color-accent-gold)]/40"
                        />
                      </div>
                      <div>
                        <label className="block">
                          <div className="mb-1 flex items-center justify-between">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.55)]">
                              State
                            </div>
                          </div>

                          <div className="relative">
                            <select
                              value={state}
                              onChange={(e) => setState(e.target.value)}
                              className="w-full appearance-none  border border-[rgb(var(--color-border-rgb)/0.14)] bg-[var(--color-card-hover))] px-3 py-2 pr-10 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[#0a90f0]/40 cursor-pointer"
                            >
                              <option value="">Select state</option>

                              {STATE_OPTIONS.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.label}
                                </option>
                              ))}
                            </select>

                            <svg
                              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/65"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path
                                fillRule="evenodd"
                                d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                        </label>
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.55)]">
                          ZIP
                        </label>
                        <input
                          value={zip}
                          onChange={(e) =>
                            setZip(e.target.value.replace(/[^0-9-]/g, ""))
                          }
                          inputMode="numeric"
                          maxLength={10}
                          placeholder="78205"
                          className="w-full  border border-[rgb(var(--color-border-rgb)/0.14)] bg-[var(--color-card-hover))] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent-gold)]/40"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs md:text-md mb-2  font-semibold text-[var(--color-text)]">
                      Assign workers{" "}
                      <span className="text-[var(--color-text)]/70">
                        (optional)
                      </span>
                    </div>

                    {/* Search box for filtering employees */}
                    <input
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      placeholder="Search workers…"
                      className="mt-2 w-full  px-3 py-2 text-xs text-[rgb(var(--color-text-rgb)/0.92)] focus:ring-1 ring-[var(--color-text)]/10 focus:ring-[var(--color-text)]/20 "
                    />

                    <div className="section-scroll-workers mt-2 max-h-40  p-2 ">
                      {filteredEmployeesList.length === 0 ? (
                        <div className="text-sm text-[rgb(var(--color-text-rgb)/0.62)]">
                          {employees.length === 0
                            ? "No active members found."
                            : "No matching workers."}
                        </div>
                      ) : (
                        filteredEmployeesList.map((emp) => {
                          const checked = assignedEmployeeIds.includes(emp.id);
                          return (
                            <label
                              key={emp.id}
                              className="flex cursor-pointer items-center justify-between gap-3 px-2 py-2"
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

                    {/* Show Select All / Clear All when there are many employees */}
                    {filteredEmployeesList.length >= 7 && (
                      <div className="mt-1 flex justify-end gap-2 text-xs text-[rgb(var(--color-text-rgb)/0.62)]">
                        <button
                          type="button"
                          onClick={() =>
                            setAssignedEmployeeIds(
                              filteredEmployeesList.map((emp) => emp.id)
                            )
                          }
                          className="underline hover:opacity-80"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => setAssignedEmployeeIds([])}
                          className="underline hover:opacity-80"
                        >
                          Clear All
                        </button>
                      </div>
                    )}

                    {assignedEmployeeIds.length > 0 && (
                      <div className="mt-5 mb-2 text-xs text-[rgb(var(--color-text-rgb)/0.62)]">
                        <div className="text-xs md:text-[13px] text-[var(--color-text)]">
                          {assignedEmployees.length === 0 ? (
                            "No workers assigned"
                          ) : (
                            <>
                              {visible.map((e) => e.name).join(", ")}
                              {remaining > 0 && ` +${remaining}`}
                            </>
                          )}
                        </div>
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

                  <h3 className="text-xs md:text-md font-semibold uppercase tracking-wide text-[var(--color-text)] mb-3">
                    Scheduling (optional)
                  </h3>
                  {/* Schedule fields */}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3 w-full">
                    <div className="w-full">
                      <label className="mb-1 block text-[11px]  font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.55)]">
                        Felt
                      </label>
                      <input
                        type="date"
                        value={newFeltDate}
                        onChange={(e) => setNewFeltDate(e.target.value)}
                        className="w-full  border border-[rgb(var(--color-border-rgb)/0.14)] bg-[var(--color-card-hover)] px-2 py-2 text-xs text-[rgb(var(--color-text-rgb)/0.92)]"
                      />
                    </div>

                    <div className="w-full">
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.55)]">
                        Shingles
                      </label>
                      <input
                        type="date"
                        value={newShinglesDate}
                        onChange={(e) => setNewShinglesDate(e.target.value)}
                        className="w-full border border-[rgb(var(--color-border-rgb)/0.14)] bg-[var(--color-card-hover)] px-2 py-2 text-xs text-[rgb(var(--color-text-rgb)/0.92)]"
                      />
                    </div>

                    <div className="w-full">
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.55)]">
                        Punch
                      </label>
                      <input
                        type="date"
                        value={newPunchDate}
                        onChange={(e) => setNewPunchDate(e.target.value)}
                        className="w-full border border-[rgb(var(--color-border-rgb)/0.14)] bg-[var(--color-card-hover)] px-2 py-2 text-xs text-[rgb(var(--color-text-rgb)/0.92)]"
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
                      setCity("");
                      setZip("");
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

        {/* Content */}
        {jobsOpen && (
          <div>
            {/* Status Filters row (only when expanded) */}
            {jobsOpen && (
              <div className="border-b border-[var(--color-border)] px-4 py-3 sm:px-6 flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {filters.map((f) => {
                  const active = statusFilter === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setStatusFilter(f)}
                      className={cx(
                        "whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition hover:shadow-md",
                        active
                          ? "border-[var(--color-accent-gold)]/30 bg-[var(--color-accent-gold)]/10 text-[var(--color-accent-gold)]"
                          : "border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] text-[rgb(var(--color-text-rgb)/0.62)] hover:bg-[rgb(var(--color-surface-rgb)/0.75)] hover:text-[var(--color-text)]"
                      )}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="min-w-0">
              {/* Main list/table */}
              <motion.div {...fadeUp(0.08)} className="min-w-0">
                <div className=" overflow-hidden">
                  {/* Mobile cards */}
                  <div className="md:hidden overflow-hidden">
                    {/* Scrollable mobile list */}
                    <div className="grid gap-2 p-2 section-scroll pb-20">
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
                            className="border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] hover:bg-[rgb(var(--color-surface-rgb)/0.55)] transition px-3 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-[rgb(var(--color-text-rgb)/0.92)]">
                                      {a.line1 || a.display || "—"}
                                    </div>
                                    {a.cityStateZip && (
                                      <div className="mt-0.5 text-[11px] text-[rgb(var(--color-text-rgb)/0.55)] truncate">
                                        {a.cityStateZip}
                                      </div>
                                    )}
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

                                <div className="mt-3 grid grid-cols-3 gap-2">
                                  <div>
                                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.45)]">
                                      Dry in
                                    </div>
                                    <StagePill
                                      job={job}
                                      stage="dryIn"
                                      compact
                                      onOpenScheduleStage={openStageSchedule}
                                    />
                                  </div>

                                  <div>
                                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.45)]">
                                      Shingles
                                    </div>
                                    <StagePill
                                      job={job}
                                      stage="shingles"
                                      compact
                                      onOpenScheduleStage={openStageSchedule}
                                    />
                                  </div>

                                  <div>
                                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.45)]">
                                      Punch
                                    </div>
                                    <StagePill
                                      job={job}
                                      stage="punch"
                                      compact
                                      onOpenScheduleStage={openStageSchedule}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0 text-right">
                                <div className="text-[11px] text-[rgb(var(--color-text-rgb)/0.45)]">
                                  Profit
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
                    </div>

                    {/* Sticky mobile pagination footer */}
                    {filteredJobs.length > 0 && (
                      <div className="sticky bottom-0 z-30 flex items-center justify-between gap-3 border-t border-[var(--color-border)]/60 bg-[var(--color-background)] px-4 py-3 text-xs text-[rgb(var(--color-text-rgb)/0.55)]">
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
                    <div className="relative max-h-[650px] overflow-y-auto section-scroll">
                      <table className="w-full table-fixed text-sm">
                        <colgroup>
                          <col className="w-[22%]" />
                          <col className="w-[9%]" />
                          <col className="w-[12%]" />
                          <col className="w-[12%]" />
                          <col className="w-[12%]" />
                          <col className="w-[9%]" />
                          <col className="w-[14%]" />
                          <col className="w-[10%]" />
                        </colgroup>

                        <thead className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-card)]/60 backdrop-blur">
                          <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.70)]">
                            <th className="px-4 py-3">Job</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Dry in</th>
                            <th className="px-4 py-3">Shingles</th>
                            <th className="px-4 py-3">Punch</th>
                            <th className="px-4 py-3 text-right">Profit</th>
                            <th className="px-4 py-3">Last updated</th>
                            <th className="px-4 py-3 text-right">Action</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-[rgb(var(--color-border-rgb)/0.12)]">
                          {pagedJobs.map((job) => {
                            const a = addr(job.address);
                            const net = job.computed?.netProfitCents ?? 0;

                            return (
                              <motion.tr
                                key={job.id}
                                variants={item}
                                className="rz-dashboard-table-row bg-[rgb(var(--color-surface-rgb)/0.42)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.68)]"
                              >
                                <td className="px-4 py-3 align-middle">
                                  <div className="truncate font-semibold text-[var(--color-text)]">
                                    <Link
                                      to={`/job/${job.id}`}
                                      className="hover:underline"
                                    >
                                      {a.line1 || a.display || "Untitled job"}
                                    </Link>
                                  </div>

                                  <div className="mt-0.5 truncate text-xs text-[rgb(var(--color-text-rgb)/0.58)]">
                                    {a.cityStateZip || "—"}
                                  </div>
                                </td>

                                <td className="px-4 py-3 align-middle">
                                  <span
                                    className={cx(
                                      "inline-flex max-w-full truncate text-[11px] font-bold uppercase tracking-wide",
                                      statusClasses(job.status)
                                    )}
                                  >
                                    {job.status}
                                  </span>
                                </td>

                                <td className="px-4 py-3 align-middle">
                                  <StagePill
                                    job={job}
                                    stage="dryIn"
                                    onOpenScheduleStage={openStageSchedule}
                                  />
                                </td>

                                <td className="px-4 py-3 align-middle">
                                  <StagePill
                                    job={job}
                                    stage="shingles"
                                    onOpenScheduleStage={openStageSchedule}
                                  />
                                </td>

                                <td className="px-4 py-3 align-middle">
                                  <StagePill
                                    job={job}
                                    stage="punch"
                                    onOpenScheduleStage={openStageSchedule}
                                  />
                                </td>

                                <td className="px-4 py-3 text-right align-middle font-semibold">
                                  <span
                                    className={cx(
                                      net >= 0
                                        ? "text-[rgb(var(--pill-success-rgb))]"
                                        : "text-[rgb(var(--pill-danger-rgb))]"
                                    )}
                                  >
                                    <CountMoney cents={net} />
                                  </span>
                                </td>

                                <td className="px-4 py-3 align-middle text-[12px] text-[rgb(var(--color-text-rgb)/0.72)]">
                                  <div className="truncate">
                                    {fmtDateTime(
                                      job.updatedAt ?? job.createdAt
                                    )}
                                  </div>
                                </td>

                                <td className="px-4 py-3 text-right align-middle">
                                  <Link
                                    to={`/job/${job.id}`}
                                    className="inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-[rgb(var(--color-border-rgb)/0.28)] bg-[rgb(var(--color-background-rgb)/0.35)] px-3 py-1.5 text-[12px] font-semibold text-[rgb(var(--color-text-rgb)/0.82)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.75)] hover:text-[var(--color-text)]"
                                  >
                                    View
                                  </Link>
                                </td>
                              </motion.tr>
                            );
                          })}

                          {pagedJobs.length === 0 && (
                            <tr>
                              <td
                                colSpan={8}
                                className="px-4 py-10 text-center text-[rgb(var(--color-text-rgb)/0.55)]"
                              >
                                No jobs match the current filters.
                              </td>
                            </tr>
                          )}
                        </tbody>

                        <tbody aria-hidden>
                          <tr>
                            <td colSpan={8} className="h-12 p-0" />
                          </tr>
                        </tbody>
                      </table>

                      {/* Sticky pagination footer */}
                      {filteredJobs.length > 0 && (
                        <div className="sticky bottom-[-1px] z-30 flex items-center justify-between gap-3 border-t border-[var(--color-border)]/60 bg-[var(--color-background)] px-4 py-2 text-xs text-[rgb(var(--color-text-rgb)/0.55)]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>
                              Showing {(jobsPage - 1) * JOBS_PER_PAGE + 1} –{" "}
                              {Math.min(
                                jobsPage * JOBS_PER_PAGE,
                                filteredJobs.length
                              )}{" "}
                              of {filteredJobs.length}
                            </span>

                            <span className="hidden lg:inline-flex rounded-full border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-2.5 py-1 text-[11px] font-semibold text-[rgb(var(--color-text-rgb)/0.72)]">
                              Total profit:
                              <span className="ml-1 text-[rgb(var(--pill-success-rgb))]">
                                <CountMoney cents={totalNet} />
                              </span>
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={jobsPage === 1}
                              onClick={() =>
                                setJobsPage((p) => Math.max(1, p - 1))
                              }
                              className="rounded-full border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-1 font-semibold text-[rgb(var(--color-text-rgb)/0.72)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.75)] disabled:opacity-40"
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
                              className="rounded-full border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-1 font-semibold text-[rgb(var(--color-text-rgb)/0.72)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.75)] disabled:opacity-40"
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
            </div>
          </div>
        )}
      </section>

      <AnimatePresence>
        {localScheduleModal && (
          <motion.div
            className="fixed inset-0 z-[140] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.98, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 14, scale: 0.98, filter: "blur(8px)" }}
              transition={{ duration: 0.22, ease: EASE }}
              className="w-full max-w-[390px] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-[0_30px_90px_rgba(0,0,0,0.65)]"
            >
              <div className="border-b border-[var(--color-border)] bg-[rgb(var(--color-surface-rgb)/0.35)] px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold text-[var(--color-text)]">
                      {addr(localScheduleModal.job.address).line1 ||
                        addr(localScheduleModal.job.address).display ||
                        "Untitled job"}
                    </h3>

                    {addr(localScheduleModal.job.address).cityStateZip ? (
                      <p className="mt-0.5 truncate text-xs text-[rgb(var(--color-text-rgb)/0.58)]">
                        {addr(localScheduleModal.job.address).cityStateZip}
                      </p>
                    ) : null}

                    <p className="mt-4 text-sm font-semibold text-[var(--color-text)]">
                      {ymdFromUnknown(
                        (localScheduleModal.job as any)[
                          scheduledFieldForStage(localScheduleModal.stage)
                        ] ?? null
                      )
                        ? "Rescheduling"
                        : "Scheduling"}{" "}
                      {stageLabel(localScheduleModal.stage)}
                    </p>

                    <p className="mt-1 text-xs text-[rgb(var(--color-text-rgb)/0.58)]">
                      Pick the scheduled date below. This updates the job
                      schedule immediately after you save.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeLocalScheduleModal}
                    disabled={localScheduleSaving}
                    className="rounded-xl border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-surface-rgb)/0.45)] px-3 py-2 text-sm font-semibold text-[var(--color-text)]/70 transition hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text)] disabled:opacity-60"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.55)]">
                    {stageLabel(localScheduleModal.stage)} date
                  </span>

                  <input
                    type="date"
                    value={localScheduleDate}
                    onChange={(e) => setLocalScheduleDate(e.target.value)}
                    disabled={localScheduleSaving}
                    className="w-full rounded-xl border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-surface-rgb)/0.45)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent-gold)]/35 disabled:opacity-60"
                  />
                </label>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeLocalScheduleModal}
                    disabled={localScheduleSaving}
                    className="rounded-xl border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-surface-rgb)/0.35)] px-4 py-2 text-xs font-semibold text-[rgb(var(--color-text-rgb)/0.72)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.65)] hover:text-[var(--color-text)] disabled:opacity-60"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={saveLocalScheduleDate}
                    disabled={localScheduleSaving || !localScheduleDate}
                    className="rounded-xl border border-[var(--color-accent-gold)]/35 bg-[var(--color-accent-gold)]/12 px-4 py-2 text-xs font-semibold text-[var(--color-accent-gold)] transition hover:bg-[var(--color-accent-gold)]/18 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {localScheduleSaving ? "Saving…" : "Save schedule"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
