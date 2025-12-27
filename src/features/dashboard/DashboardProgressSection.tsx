import type { Dispatch, SetStateAction } from "react";
import { Link } from "react-router-dom";
import { motion, type MotionProps, type Variants } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { Job } from "../../types/types";

// ----- Animation helpers -----
const EASE = [0.16, 1, 0.3, 1] as const;

const fadeUp = (delay = 0): Partial<MotionProps> => ({
  initial: { opacity: 0, y: 12, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.5, ease: EASE, delay },
});

const staggerParent: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.02 },
  },
};

const item: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
};

// ----- Date utils -----
type FsTs = { toDate: () => Date };

function isFsTimestamp(val: unknown): val is FsTs {
  return typeof (val as FsTs)?.toDate === "function";
}

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

// ----- Address + status helpers (mirrors DashboardPage) -----
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

type JobStatus = Job["status"];

/**
 * Dark-mode friendly status pill styles.
 * (Your older ones were light-theme oriented: bg-yellow-100 etc.)
 */
function statusClasses(status: JobStatus) {
  switch (status) {
    case "active":
      return "border-[var(--color-accent-gold)]/30 bg-[var(--color-accent-gold)]/10 text-[var(--color-accent-gold)]";
    case "pending":
      return "border-white/12 bg-white/5 text-white/70";
    case "invoiced":
      return "border-white/12 bg-white/5 text-white/70";
    case "paid":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
    case "completed":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
    case "closed":
      return "border-white/10 bg-white/5 text-white/60";
    case "archived":
      return "border-white/10 bg-white/5 text-white/60";
    case "draft":
    default:
      return "border-white/10 bg-white/5 text-white/60";
  }
}

export interface DashboardProgressSectionProps {
  upcomingOpen: boolean;
  setUpcomingOpen: Dispatch<SetStateAction<boolean>>;
  materialProgressJobs: Job[];
  readyForPunchJobs: Job[];
}

export function DashboardProgressSection({
  upcomingOpen,
  setUpcomingOpen,
  materialProgressJobs,
  readyForPunchJobs,
}: DashboardProgressSectionProps) {
  return (
    <section className="mt-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-[0_18px_50px_rgba(0,0,0,0.35)] overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--color-border)] px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-[var(--color-text)] tracking-wide">
              JOB PIPELINE
            </h2>
            <div className="text-[12px] text-[var(--color-accent-gold)]/70">
              Scheduled production & punch readiness
            </div>
          </div>

          <button
            type="button"
            onClick={() => setUpcomingOpen((v) => !v)}
            className="ml-2 inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-black/20 hover:bg-black/30 px-3 py-1.5 text-[11px] font-semibold text-white/75 transition"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                upcomingOpen ? "rotate-0" : "-rotate-90"
              }`}
            />
            <span className="hidden sm:inline">
              {upcomingOpen ? "Collapse" : "Expand"}
            </span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px]">
          {materialProgressJobs.length > 0 && (
            <span className="inline-flex items-center rounded-full border border-sky-300/15 bg-sky-300/10 px-3 py-1 font-semibold text-sky-200">
              {materialProgressJobs.length} job
              {materialProgressJobs.length === 1 ? "" : "s"} in progress
            </span>
          )}

          {readyForPunchJobs.length > 0 && (
            <span className="inline-flex items-center rounded-full border border-emerald-300/15 bg-emerald-300/10 px-3 py-1 font-semibold text-emerald-200">
              {readyForPunchJobs.length} ready for punch
            </span>
          )}
        </div>
      </div>

      {upcomingOpen && (
        <div className="px-4 sm:px-6 py-5">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Scheduled dry-in + shingles */}
            <motion.div {...fadeUp(0.05)} className="min-w-0">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                  Scheduled dry-in & shingles
                </h3>
                <span className="text-[11px] text-[var(--color-accent-gold)]/70">
                  Live from jobs
                </span>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-black/20 overflow-hidden">
                {materialProgressJobs.length === 0 ? (
                  <div className="px-4 py-3 text-[12px] text-white/55">
                    No jobs have felt or shingles scheduled yet. As you update
                    each job, they&apos;ll show up here.
                  </div>
                ) : (
                  <motion.div
                    className="max-h-[60vh] overflow-y-auto section-scroll space-y-2 p-2"
                    variants={staggerParent}
                    initial="initial"
                    animate="animate"
                  >
                    {materialProgressJobs.map((job) => {
                      const a = addr(job.address);

                      const feltSch = toMillis(
                        (job as any).feltScheduledFor ?? null
                      );
                      const feltDone = toMillis(
                        (job as any).feltCompletedAt ?? null
                      );
                      const shinglesSch = toMillis(
                        (job as any).shinglesScheduledFor ?? null
                      );
                      const shinglesDone = toMillis(
                        (job as any).shinglesCompletedAt ?? null
                      );

                      const fmt = (ms: number | null) =>
                        ms == null
                          ? ""
                          : new Date(ms).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            });

                      const feltLabel = feltDone
                        ? `Completed ${fmt(feltDone)}`
                        : feltSch
                        ? `Scheduled ${fmt(feltSch)}`
                        : "Not scheduled";

                      const shinglesLabel = shinglesDone
                        ? `Completed ${fmt(shinglesDone)}`
                        : shinglesSch
                        ? `Scheduled ${fmt(shinglesSch)}`
                        : "Not scheduled";

                      const pillClass = (
                        done: number | null,
                        scheduled: number | null
                      ) =>
                        done != null
                          ? "border-emerald-300/15 bg-emerald-300/10 text-emerald-200"
                          : scheduled != null
                          ? "border-sky-300/15 bg-sky-300/10 text-sky-200"
                          : "border-white/10 bg-white/5 text-white/60";

                      return (
                        <motion.div
                          key={job.id}
                          variants={item}
                          whileHover={{
                            y: -1,
                            transition: { duration: 0.2, ease: EASE },
                          }}
                          className="rounded-xl border border-white/10 bg-black/20 hover:bg-black/30 transition px-3 py-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-sm font-semibold text-white">
                              {a.display || "—"}
                            </div>

                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClasses(
                                job.status
                              )}`}
                            >
                              {job.status}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                            <span
                              className={
                                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 " +
                                pillClass(feltDone, feltSch)
                              }
                            >
                              <span className="font-semibold uppercase">
                                Dry in
                              </span>
                              <span className="truncate max-w-[180px]">
                                {feltLabel}
                              </span>
                            </span>

                            <span
                              className={
                                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 " +
                                pillClass(shinglesDone, shinglesSch)
                              }
                            >
                              <span className="font-semibold uppercase">
                                Shingles
                              </span>
                              <span className="truncate max-w-[180px]">
                                {shinglesLabel}
                              </span>
                            </span>
                          </div>

                          <div className="mt-2 flex justify-between items-center gap-3">
                            <div className="text-[11px] text-white/45">
                              Last updated {fmtDateTime(job.updatedAt)}
                            </div>

                            <Link
                              to={`/job/${job.id}`}
                              className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/70 transition"
                            >
                              View job
                            </Link>
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </div>
            </motion.div>

            {/* Ready for punch */}
            <motion.div {...fadeUp(0.12)} className="min-w-0">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                  Ready for punch
                </h3>
                <span className="text-[11px] text-[var(--color-accent-gold)]/70">
                  Final pass queue
                </span>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-black/20 overflow-hidden">
                {readyForPunchJobs.length === 0 ? (
                  <div className="px-4 py-3 text-[12px] text-white/55">
                    Once both felt and shingles are marked completed on a job,
                    it will appear here as ready to be punched.
                  </div>
                ) : (
                  <motion.div
                    className="max-h-[60vh] overflow-y-auto section-scroll space-y-2 p-2"
                    variants={staggerParent}
                    initial="initial"
                    animate="animate"
                  >
                    {readyForPunchJobs.map((job) => {
                      const a = addr(job.address);

                      const feltDone = toMillis(
                        (job as any).feltCompletedAt ?? null
                      );
                      const shinglesDone = toMillis(
                        (job as any).shinglesCompletedAt ?? null
                      );
                      const lastStage = Math.max(
                        feltDone ?? 0,
                        shinglesDone ?? 0
                      );
                      const readySince =
                        lastStage > 0
                          ? new Date(lastStage).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : null;

                      const punchMs = toMillis(
                        (job as any).punchScheduledFor ?? null
                      );
                      const punchDate =
                        punchMs != null
                          ? new Date(punchMs).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : null;

                      return (
                        <motion.div
                          key={job.id}
                          variants={item}
                          whileHover={{
                            y: -1,
                            transition: { duration: 0.2, ease: EASE },
                          }}
                          className="rounded-xl border border-white/10 bg-black/20 hover:bg-black/30 transition px-3 py-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="truncate text-sm font-semibold text-white">
                                  {a.display || "—"}
                                </div>
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClasses(
                                    job.status
                                  )}`}
                                >
                                  {job.status}
                                </span>
                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                                {readySince ? (
                                  <span className="text-white/45">
                                    Ready since {readySince}
                                  </span>
                                ) : (
                                  <span className="text-white/45">Ready</span>
                                )}

                                {punchDate ? (
                                  <span className="text-[var(--color-accent-gold)]/80">
                                    • Scheduled for {punchDate}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex flex-col gap-1 text-[11px] shrink-0">
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/15 bg-emerald-300/10 px-2 py-0.5 text-emerald-200">
                                <span className="font-semibold uppercase">
                                  Dry in
                                </span>
                                <span>Completed</span>
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/15 bg-emerald-300/10 px-2 py-0.5 text-emerald-200">
                                <span className="font-semibold uppercase">
                                  Shingles
                                </span>
                                <span>Completed</span>
                              </span>
                            </div>
                          </div>

                          <div className="mt-2 flex justify-end">
                            <Link
                              to={`/job/${job.id}`}
                              className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/70 transition"
                            >
                              View job
                            </Link>
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </section>
  );
}
