import {
  useRef,
  type RefObject,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Link } from "react-router-dom";
import { motion, type MotionProps } from "framer-motion";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
} from "lucide-react";

import type { Job } from "../../types/types";

// ----- Animation helpers -----
const EASE = [0.16, 1, 0.3, 1] as const;

// Simple fade-up animation; reused for sections
const fadeUp = (delay = 0): Partial<MotionProps> => ({
  initial: { opacity: 0, y: 12, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.5, ease: EASE, delay },
});

// ----- Utility helpers -----

/**
 * Determine if an arbitrary value is a Firestore-like timestamp.
 */
type FsTs = { toDate: () => Date };

function isFsTimestamp(val: unknown): val is FsTs {
  return typeof (val as FsTs)?.toDate === "function";
}

/**
 * Convert various date-like values into milliseconds. Returns null if invalid.
 */
function toMillis(x: unknown): number | null {
  if (x == null) return null;
  if (x instanceof Date) return x.getTime();
  if (typeof x === "number") return x;
  if (typeof x === "string") {
    const d = new Date(x);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  if (isFsTimestamp(x)) {
    const d = x.toDate();
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  return null;
}

/**
 * Format a millisecond timestamp into an abbreviated date string.
 * Returns an empty string if ms is null.
 */
const fmt = (ms: number | null) =>
  ms == null
    ? ""
    : new Date(ms).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

/**
 * Extract a normalized address from a Job's address field. Copied from older implementation.
 */
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

function matchesAddress(job: Job, term: string) {
  const q = term.trim().toLowerCase();
  if (!q) return true;

  const a = addr(job.address);
  const haystack = [a.display, a.line1, a.city, a.state, a.zip]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type StageKind = "dryIn" | "shingles" | "punch";

function daysUntilLabel(ms: number | null) {
  if (ms == null) return "Unscheduled";

  const target = new Date(ms);
  const now = new Date();

  const targetStart = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  ).getTime();

  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();

  const diffDays = Math.round((targetStart - todayStart) / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return `In ${diffDays} days`;
}

function stageAccentClasses(stage: StageKind) {
  if (stage === "punch") {
    return {
      bar: "bg-[rgb(var(--pill-success-rgb))]",
      glow: "bg-[rgb(var(--pill-success-rgb)/0.14)]",
      chip: "border-[rgb(var(--pill-success-rgb)/0.28)] bg-[rgb(var(--pill-success-rgb)/0.10)] text-[rgb(var(--pill-success-rgb))]",
      date: "border-[rgb(var(--pill-success-rgb)/0.24)] bg-[rgb(var(--pill-success-rgb)/0.10)]",
    };
  }

  return {
    bar: "bg-[rgb(var(--pill-info-rgb))]",
    glow: "bg-[rgb(var(--pill-info-rgb)/0.14)]",
    chip: "border-[rgb(var(--pill-info-rgb)/0.28)] bg-[rgb(var(--pill-info-rgb)/0.10)] text-[rgb(var(--pill-info-rgb))]",
    date: "border-[rgb(var(--pill-info-rgb)/0.24)] bg-[rgb(var(--pill-info-rgb)/0.10)]",
  };
}

function StageScrollButtons({
  onPrev,
  onNext,
}: {
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="hidden md:flex gap-1">
      <button
        type="button"
        onClick={onPrev}
        className="grid h-8 w-8 place-items-center rounded-full border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-surface-rgb)/0.52)] text-[rgb(var(--color-text-rgb)/0.72)] shadow-sm transition hover:-translate-y-0.5 hover:bg-[rgb(var(--color-surface-rgb)/0.78)] hover:text-[rgb(var(--color-text-rgb)/0.95)] hover:shadow-md"
        aria-label="Scroll left"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onNext}
        className="grid h-8 w-8 place-items-center rounded-full border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-surface-rgb)/0.52)] text-[rgb(var(--color-text-rgb)/0.72)] shadow-sm transition hover:-translate-y-0.5 hover:bg-[rgb(var(--color-surface-rgb)/0.78)] hover:text-[rgb(var(--color-text-rgb)/0.95)] hover:shadow-md"
        aria-label="Scroll right"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function StageHeader({
  title,
  count,
  onPrev,
  onNext,
}: {
  title: string;
  count: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold uppercase tracking-wider text-[var(--color-text)]">
            {title}
          </h3>

          {count > 0 && (
            <span className="rounded-full border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.42)] px-2 py-0.5 text-[10px] font-semibold text-[rgb(var(--color-text-rgb)/0.58)]">
              {count}
            </span>
          )}
        </div>

        <div className="mt-0.5 h-px w-16 bg-gradient-to-r from-[var(--color-accent-gold)]/60 to-transparent" />
      </div>

      <StageScrollButtons onPrev={onPrev} onNext={onNext} />
    </div>
  );
}

function PipelineJobCard({
  job,
  stage,
  label,
  scheduledMs,
}: {
  job: Job;
  stage: StageKind;
  label: string;
  scheduledMs: number | null;
}) {
  const a = addr(job.address);
  const accent = stageAccentClasses(stage);

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.22, ease: EASE }}
      className="group relative flex-shrink-0 w-[230px] sm:w-[260px] md:w-[280px] lg:w-[300px] overflow-hidden rounded-xl border border-[rgb(var(--color-border-rgb)/0.16)] bg-[var(--color-card)] shadow-sm transition hover:border-[rgb(var(--color-border-rgb)/0.26)] hover:bg-[var(--color-card-hover)] hover:shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
    >
      {/* stage accent */}
      <div className={cx("absolute inset-y-0 left-0 w-1", accent.bar)} />

      {/* soft glow */}
      <div
        className={cx(
          "pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full blur-3xl opacity-0 transition duration-300 group-hover:opacity-100",
          accent.glow
        )}
      />

      <div className="relative p-3 pl-4">
        {/* date row */}
        <div className="flex items-start justify-between gap-3">
          <div
            className={cx("min-w-0 rounded-lg border px-2.5 py-2", accent.date)}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.52)]">
              <CalendarDays className="h-3.5 w-3.5" />
              Scheduled
            </div>

            <div className="mt-1 truncate text-[15px] font-semibold leading-tight text-[var(--color-text)]">
              {label || "—"}
            </div>
          </div>

          <span
            className={cx(
              "shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold",
              accent.chip
            )}
          >
            {daysUntilLabel(scheduledMs)}
          </span>
        </div>

        {/* address */}
        <div className="mt-3 flex gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--color-text-rgb)/0.42)]" />

          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[rgb(var(--color-text-rgb)/0.92)]">
              {a.line1 || a.display || "—"}
            </div>

            {(a.city || a.state || a.zip) && (
              <div className="mt-0.5 truncate text-[11px] font-medium text-[rgb(var(--color-text-rgb)/0.52)]">
                {[a.city, a.state, a.zip].filter(Boolean).join(", ")}
              </div>
            )}
          </div>
        </div>

        {/* footer */}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[rgb(var(--color-border-rgb)/0.12)] pt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.42)]">
            Upcoming
          </div>

          <Link
            to={`/job/${job.id}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-1.5 text-[11px] font-semibold text-[rgb(var(--color-text-rgb)/0.76)] transition hover:border-[rgb(var(--color-border-rgb)/0.28)] hover:bg-[rgb(var(--color-surface-rgb)/0.78)] hover:text-[rgb(var(--color-text-rgb)/0.95)]"
          >
            View job
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

export interface DashboardProgressSectionProps {
  /** Whether the section is expanded or collapsed */
  upcomingOpen: boolean;
  /** Toggle for collapsing/expanding the section */
  setUpcomingOpen: Dispatch<SetStateAction<boolean>>;
  /** List of jobs with material progress (dry-in/shingles), as provided by the parent hook */
  materialProgressJobs: Job[];
  /** List of jobs ready for punch, as provided by the parent hook */
  readyForPunchJobs: Job[];
  /** Local pipeline search term */
  searchTerm: string;
  /** Setter for local pipeline search term */
  setSearchTerm: Dispatch<SetStateAction<string>>;
}

/**
 * DashboardProgressSection displays upcoming jobs separated into Dry In, Shingles, and Punch.
 * Only jobs with scheduled dates on or after the current date are shown for each section.
 * Punch jobs are determined purely by the presence of a punchScheduledFor date.
 */
export function DashboardProgressSection({
  upcomingOpen,
  materialProgressJobs,
  readyForPunchJobs,
  searchTerm,
  setSearchTerm,
}: DashboardProgressSectionProps) {
  // Determine the start of the current day (00:00 in the user's locale)
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayMs = todayStart.getTime();

  // Derive Dry In jobs: those with a feltScheduledFor date today or later
  const dryInJobs = materialProgressJobs.filter((job) => {
    const scheduleMs = toMillis((job as any).feltScheduledFor ?? null);
    return scheduleMs != null && scheduleMs >= todayMs;
  });

  // Derive Shingles jobs: those with a shinglesScheduledFor date today or later
  const shinglesJobs = materialProgressJobs.filter((job) => {
    const scheduleMs = toMillis((job as any).shinglesScheduledFor ?? null);
    return scheduleMs != null && scheduleMs >= todayMs;
  });

  // Derive Punch jobs: include both materialProgressJobs and readyForPunchJobs, and pick those with a punchScheduledFor date today or later
  const punchJobs = [...materialProgressJobs, ...readyForPunchJobs].filter(
    (job) => {
      const scheduleMs = toMillis((job as any).punchScheduledFor ?? null);
      return scheduleMs != null && scheduleMs >= todayMs;
    }
  );

  const filteredDryInJobs = dryInJobs.filter((job) =>
    matchesAddress(job, searchTerm)
  );

  const filteredShinglesJobs = shinglesJobs.filter((job) =>
    matchesAddress(job, searchTerm)
  );

  const filteredPunchJobs = punchJobs.filter((job) =>
    matchesAddress(job, searchTerm)
  );

  // Label creators for each section; they return the scheduled date string
  const getDryLabel = (job: Job) => {
    const ms = toMillis((job as any).feltScheduledFor ?? null);
    return ms != null ? fmt(ms) : "";
  };
  const getShinglesLabel = (job: Job) => {
    const ms = toMillis((job as any).shinglesScheduledFor ?? null);
    return ms != null ? fmt(ms) : "";
  };
  const getPunchLabel = (job: Job) => {
    const ms = toMillis((job as any).punchScheduledFor ?? null);
    return ms != null ? fmt(ms) : "";
  };

  // Refs for horizontal scrollable containers
  const dryRef = useRef<HTMLDivElement>(null);
  const shinglesRef = useRef<HTMLDivElement>(null);
  const punchRef = useRef<HTMLDivElement>(null);

  // Function factory to scroll a container left/right by 80% of its width
  const createScrollBy =
    (ref: RefObject<HTMLDivElement | null>, dir: number) => () => {
      const el = ref.current;
      if (!el) return;
      const scrollAmount = el.clientWidth * 0.8;
      el.scrollBy({ left: dir * scrollAmount, behavior: "smooth" });
    };

  return (
    <section className="mt-0 bg-[var(--color-surface)] shadow-md overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-[var(--color-border)] pb-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <h1 className="text-xs md:text-md lg:text-lg font-semibold text-[var(--color-text)] uppercase font-poppins">
              SCHEDULED
            </h1>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[360px] lg:items-end">
          <div className="w-full lg:w-[360px]">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search pipeline by address..."
              className="w-full  border border-[rgb(var(--color-border-rgb)/0.16)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-2 text-sm text-[rgb(var(--color-text-rgb)/0.92)] outline-none transition placeholder:text-[rgb(var(--color-text-rgb)/0.45)] focus:border-[rgb(var(--pill-info-rgb)/0.40)] focus:bg-[rgb(var(--color-surface-rgb)/0.75)]"
            />
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            {filteredDryInJobs.length > 0 && (
              <span className="inline-flex items-center rounded-full border border-[rgb(var(--pill-info-rgb)/0.30)] bg-[rgb(var(--pill-info-rgb)/0.12)] px-3 py-1 font-semibold text-[rgb(var(--pill-info-rgb))]">
                {filteredDryInJobs.length} Dry In
                {filteredDryInJobs.length === 1 ? "" : " jobs"}
              </span>
            )}

            {filteredShinglesJobs.length > 0 && (
              <span className="inline-flex items-center rounded-full border border-[rgb(var(--pill-info-rgb)/0.30)] bg-[rgb(var(--pill-info-rgb)/0.12)] px-3 py-1 font-semibold text-[rgb(var(--pill-info-rgb))]">
                {filteredShinglesJobs.length} Shingles
                {filteredShinglesJobs.length === 1 ? "" : " jobs"}
              </span>
            )}

            {filteredPunchJobs.length > 0 && (
              <span className="inline-flex items-center rounded-full border border-[rgb(var(--pill-success-rgb)/0.30)] bg-[rgb(var(--pill-success-rgb)/0.12)] px-3 py-1 font-semibold text-[rgb(var(--pill-success-rgb))]">
                {filteredPunchJobs.length} Punch
                {filteredPunchJobs.length === 1 ? "" : " jobs"}
              </span>
            )}
          </div>
        </div>
      </div>

      {upcomingOpen && (
        <div className="px-4 sm:px-6 py-5 space-y-9">
          {/* Dry In Section */}
          <motion.div {...fadeUp(0.05)}>
            <StageHeader
              title="Dry In"
              count={filteredDryInJobs.length}
              onPrev={createScrollBy(dryRef, -1)}
              onNext={createScrollBy(dryRef, 1)}
            />
            {filteredDryInJobs.length === 0 ? (
              <div className="px-2 py-3 text-sm md:text-lg text-[rgb(var(--color-text-rgb)/0.55)]   bg-[rgb(var(--color-surface-rgb)/0.35)]">
                {searchTerm.trim()
                  ? "No dry-in jobs match that address."
                  : "No dry-in jobs scheduled for today or later."}
              </div>
            ) : (
              <div
                ref={dryRef}
                className="flex gap-3 overflow-x-auto md:overflow-x-hidden scroll-smooth pb-1"
              >
                {filteredDryInJobs.map((job) => {
                  const label = getDryLabel(job);
                  return (
                    <PipelineJobCard
                      key={job.id}
                      job={job}
                      stage="dryIn"
                      label={label}
                      scheduledMs={toMillis(
                        (job as any).feltScheduledFor ?? null
                      )}
                    />
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Shingles Section */}
          <motion.div {...fadeUp(0.08)}>
            <StageHeader
              title="Shingles"
              count={filteredShinglesJobs.length}
              onPrev={createScrollBy(shinglesRef, -1)}
              onNext={createScrollBy(shinglesRef, 1)}
            />

            {filteredShinglesJobs.length === 0 ? (
              <div className="px-2 py-3 text-sm md:text-lg text-[rgb(var(--color-text-rgb)/0.55)]   bg-[rgb(var(--color-surface-rgb)/0.35)]">
                {searchTerm.trim()
                  ? "No shingles jobs match that address."
                  : "No shingles jobs scheduled for today or later."}
              </div>
            ) : (
              <div
                ref={shinglesRef}
                className="flex gap-3 overflow-x-auto md:overflow-x-hidden scroll-smooth pb-1"
              >
                {filteredShinglesJobs.map((job) => {
                  const label = getShinglesLabel(job);
                  return (
                    <PipelineJobCard
                      key={job.id}
                      job={job}
                      stage="shingles"
                      label={label}
                      scheduledMs={toMillis(
                        (job as any).shinglesScheduledFor ?? null
                      )}
                    />
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Punch Section */}
          <motion.div {...fadeUp(0.11)}>
            <StageHeader
              title="Punch"
              count={filteredPunchJobs.length}
              onPrev={createScrollBy(punchRef, -1)}
              onNext={createScrollBy(punchRef, 1)}
            />

            {filteredPunchJobs.length === 0 ? (
              <div className="px-2 py-3 text-sm md:text-lg text-[rgb(var(--color-text-rgb)/0.55)]   bg-[rgb(var(--color-surface-rgb)/0.35)]">
                {searchTerm.trim()
                  ? "No punch jobs match that address."
                  : "No punch jobs scheduled for today or later."}
              </div>
            ) : (
              <div
                ref={punchRef}
                className="flex gap-3 overflow-x-auto md:overflow-x-hidden scroll-smooth pb-1"
              >
                {filteredPunchJobs.map((job) => {
                  const label = getPunchLabel(job);
                  return (
                    <PipelineJobCard
                      key={job.id}
                      job={job}
                      stage="punch"
                      label={label}
                      scheduledMs={toMillis(
                        (job as any).punchScheduledFor ?? null
                      )}
                    />
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </section>
  );
}
