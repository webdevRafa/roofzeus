import {
  useRef,
  type RefObject,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Link } from "react-router-dom";
import { motion, type MotionProps } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
        <div className="px-4 sm:px-6 py-5 space-y-10">
          {/* Dry In Section */}
          <motion.div {...fadeUp(0.05)}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold uppercase tracking-wider text-[var(--color-text)]">
                Dry In
              </h3>
              <div className="hidden md:flex gap-1">
                <button
                  type="button"
                  onClick={createScrollBy(dryRef, -1)}
                  className="p-1 rounded-full border border-[rgb(var(--color-border-rgb)/0.20)] bg-[rgb(var(--color-surface-rgb)/0.60)] hover:bg-[rgb(var(--color-surface-rgb)/0.75)] text-[rgb(var(--color-text-rgb)/0.80)]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={createScrollBy(dryRef, 1)}
                  className="p-1 rounded-full border border-[rgb(var(--color-border-rgb)/0.20)] bg-[rgb(var(--color-surface-rgb)/0.60)] hover:bg-[rgb(var(--color-surface-rgb)/0.75)] text-[rgb(var(--color-text-rgb)/0.80)]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
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
                  const a = addr(job.address);
                  const label = getDryLabel(job);
                  return (
                    <div
                      key={job.id}
                      className="flex-shrink-0 w-[230px] sm:w-[260px] md:w-[280px] lg:w-[300px]  bg-[var(--color-card)] hover:bg-[var(--color-card-hover)]  transition p-3 shadow-md"
                    >
                      <div className="text-lg text-[var(--color-text)] truncate">
                        {label}
                      </div>
                      <div className="mt-1 truncate text-sm font-semibold text-[rgb(var(--color-text-rgb)/0.90)]">
                        {a.display || "—"}
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Link
                          to={`/job/${job.id}`}
                          className="inline-flex items-center justify-center rounded-md border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] hover:bg-[rgb(var(--color-surface-rgb)/0.75)] px-3 py-1 text-[11px] font-semibold text-[rgb(var(--color-text-rgb)/0.72)] transition"
                        >
                          View job
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Shingles Section */}
          <motion.div {...fadeUp(0.08)}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold uppercase tracking-wider text-[var(--color-text)]">
                Shingles
              </h3>
              <div className="hidden md:flex gap-1">
                <button
                  type="button"
                  onClick={createScrollBy(shinglesRef, -1)}
                  className="p-1 rounded-full border border-[rgb(var(--color-border-rgb)/0.20)] bg-[rgb(var(--color-surface-rgb)/0.60)] hover:bg-[rgb(var(--color-surface-rgb)/0.75)] text-[rgb(var(--color-text-rgb)/0.80)]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={createScrollBy(shinglesRef, 1)}
                  className="p-1 rounded-full border border-[rgb(var(--color-border-rgb)/0.20)] bg-[rgb(var(--color-surface-rgb)/0.60)] hover:bg-[rgb(var(--color-surface-rgb)/0.75)] text-[rgb(var(--color-text-rgb)/0.80)]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
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
                  const a = addr(job.address);
                  const label = getShinglesLabel(job);
                  return (
                    <div
                      key={job.id}
                      className="flex-shrink-0 w-[230px] sm:w-[260px] md:w-[280px] lg:w-[300px]  bg-[var(--color-card)] hover:bg-[var(--color-card-hover)] shadow-md  transition p-3"
                    >
                      <div className="text-lg text-[var(--color-text)] truncate">
                        {label}
                      </div>
                      <div className="mt-1 truncate text-sm font-semibold text-[rgb(var(--color-text-rgb)/0.90)]">
                        {a.display || "—"}
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Link
                          to={`/job/${job.id}`}
                          className="inline-flex items-center justify-center rounded-md border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] hover:bg-[rgb(var(--color-surface-rgb)/0.75)] px-3 py-1 text-[11px] font-semibold text-[rgb(var(--color-text-rgb)/0.72)] transition"
                        >
                          View job
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Punch Section */}
          <motion.div {...fadeUp(0.11)}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold uppercase tracking-wider text-[var(--color-text)]">
                Punch
              </h3>
              <div className="hidden md:flex gap-1">
                <button
                  type="button"
                  onClick={createScrollBy(punchRef, -1)}
                  className="p-1 rounded-full border border-[rgb(var(--color-border-rgb)/0.20)] bg-[rgb(var(--color-surface-rgb)/0.60)] hover:bg-[rgb(var(--color-surface-rgb)/0.75)] text-[rgb(var(--color-text-rgb)/0.80)]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={createScrollBy(punchRef, 1)}
                  className="p-1 rounded-full border border-[rgb(var(--color-border-rgb)/0.20)] bg-[rgb(var(--color-surface-rgb)/0.60)] hover:bg-[rgb(var(--color-surface-rgb)/0.75)] text-[rgb(var(--color-text-rgb)/0.80)]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
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
                  const a = addr(job.address);
                  const label = getPunchLabel(job);
                  return (
                    <div
                      key={job.id}
                      className="flex-shrink-0 w-[230px] sm:w-[260px] md:w-[280px] lg:w-[300px]  bg-[var(--color-card)] hover:bg-[var(--color-card-hover)] shadow-md  transition p-3"
                    >
                      <div className="text-lg text-[var(--color-text)] truncate">
                        {label}
                      </div>
                      <div className="mt-1 truncate text-sm font-semibold text-[rgb(var(--color-text-rgb)/0.90)]">
                        {a.display || "—"}
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Link
                          to={`/job/${job.id}`}
                          className="inline-flex items-center justify-center rounded-md border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] hover:bg-[rgb(var(--color-surface-rgb)/0.75)] px-3 py-1 text-[11px] font-semibold text-[rgb(var(--color-text-rgb)/0.72)] transition"
                        >
                          View job
                        </Link>
                      </div>
                    </div>
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
