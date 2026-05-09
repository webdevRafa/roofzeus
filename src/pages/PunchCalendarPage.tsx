import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase/firebaseConfig";
import type { Job } from "../types/types";
import { jobConverter } from "../types/types";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useOrg } from "../contexts/OrgContext";

type FsTimestampLike = { toDate: () => Date };
function isFsTimestamp(x: unknown): x is FsTimestampLike {
  return typeof (x as FsTimestampLike)?.toDate === "function";
}
function toMillis(x: unknown): number | null {
  if (x == null) return null;
  if (isFsTimestamp(x)) return x.toDate().getTime();
  if (x instanceof Date) return x.getTime();
  if (typeof x === "string" || typeof x === "number") {
    const d = new Date(x);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  return null;
}
function toYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
type DayCounts = {
  felt: number;
  shingles: number;
  punch: number;
};

function makeEmptyDayCounts(): DayCounts {
  return { felt: 0, shingles: 0, punch: 0 };
}

function getMonthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function getMonthEnd(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function getMonthDays(base: Date): Date[] {
  const start = getMonthStart(base);
  const end = getMonthEnd(base);
  const out: Date[] = [];
  let cur = new Date(start);
  while (cur <= end) {
    out.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export default function PunchCalendarPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [month, setMonth] = useState<Date>(new Date());
  const navigate = useNavigate();
  const { orgId, loading } = useOrg();

  useEffect(() => {
    if (loading) return;

    if (!orgId) {
      setJobs([]);
      return;
    }

    const q = query(
      collection(db, "organizations", orgId, "jobs").withConverter(
        jobConverter
      ),
      orderBy("updatedAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) =>
      setJobs(snap.docs.map((d) => d.data()))
    );
    return () => unsub();
  }, [orgId, loading]);

  const days = useMemo(() => getMonthDays(month), [month]);

  const counts = useMemo(() => {
    const map = new Map<string, DayCounts>();

    const bump = (dateMs: number | null, field: keyof DayCounts) => {
      if (!dateMs) return;
      const d = new Date(dateMs);
      const key = toYMD(d);
      let entry = map.get(key);
      if (!entry) {
        entry = makeEmptyDayCounts();
        map.set(key, entry);
      }
      entry[field] += 1;
    };

    for (const j of jobs) {
      const anyJob = j as any;
      bump(toMillis(anyJob.feltScheduledFor), "felt");
      bump(toMillis(anyJob.shinglesScheduledFor), "shingles");
      bump(toMillis(anyJob.punchScheduledFor), "punch");
    }

    return map;
  }, [jobs]);

  function changeMonth(delta: number) {
    setMonth((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + delta);
      return d;
    });
  }

  const monthLabel = month.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  // Tiny month summary (nice UX reassurance)
  const monthTotals = useMemo(() => {
    let felt = 0,
      shingles = 0,
      punch = 0;
    for (const d of days) {
      const key = toYMD(d);
      const c = counts.get(key);
      if (!c) continue;
      felt += c.felt;
      shingles += c.shingles;
      punch += c.punch;
    }
    return { felt, shingles, punch };
  }, [days, counts]);

  const totalScheduledThisMonth =
    monthTotals.felt + monthTotals.shingles + monthTotals.punch;

  return (
    <div className="rz-dashboard-shell min-h-screen w-full pb-10 text-[var(--color-text)] bg-gradient-to-b from-[var(--color-background)] to-[var(--color-card)]">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6">
        {/* Page heading */}
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-wide text-[var(--color-text)] sm:text-2xl">
              Schedule Center
            </h1>
            <p className="mt-1 text-sm text-[rgb(var(--color-text-rgb)/0.58)]">
              Monthly view for dry-in, shingles, and punch scheduling.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-1 text-[rgb(var(--color-text-rgb)/0.62)]">
              Jobs scheduled:{" "}
              <span className="font-semibold text-[rgb(var(--color-text-rgb)/0.90)]">
                {totalScheduledThisMonth}
              </span>
            </span>

            <span className="rounded-full border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-1 text-[rgb(var(--color-text-rgb)/0.62)]">
              Month:{" "}
              <span className="font-semibold text-[rgb(var(--color-text-rgb)/0.90)]">
                {monthLabel}
              </span>
            </span>
          </div>
        </div>

        {/* Calendar shell */}
        <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm hover:shadow-md">
          {/* Header */}
          <div className="border-b border-[var(--color-border)] px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold tracking-wide text-[var(--color-text)] sm:text-xl">
                        {monthLabel}
                      </h2>

                      <span className="rounded-full  px-2.5 py-1 text-[11px] font-semibold text-[rgb(var(--color-text-rgb)/0.66)]">
                        Live schedule
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-[rgb(var(--color-text-rgb)/0.58)]">
                      Select a day to view the jobs scheduled for that date.
                    </p>
                  </div>
                </div>

                {/* Summary pills */}
                <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1 font-semibold text-sky-300">
                    <span className="h-2 w-2 rounded-full bg-sky-300" />
                    Dry-in: {monthTotals.felt}
                  </span>

                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-accent-gold)]/30 bg-[var(--color-accent-gold)]/10 px-3 py-1 font-semibold text-[var(--color-accent-gold)]">
                    <span className="h-2 w-2 rounded-full bg-[var(--color-accent-gold)]" />
                    Shingles: {monthTotals.shingles}
                  </span>

                  <span className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--pill-success-rgb)/0.30)] bg-[rgb(var(--pill-success-rgb)/0.12)] px-3 py-1 font-semibold text-[rgb(var(--pill-success-rgb))]">
                    <span className="h-2 w-2 rounded-full bg-[rgb(var(--pill-success-rgb))]" />
                    Punch: {monthTotals.punch}
                  </span>
                </div>
              </div>

              {/* Month controls */}
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => changeMonth(-1)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-card-hover)] text-[rgb(var(--color-text-rgb)/0.78)] transition hover:bg-[var(--color-card)] hover:text-[rgb(var(--color-text-rgb)/0.95)]"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setMonth(new Date())}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card-hover)] px-3 py-2 text-xs font-semibold text-[rgb(var(--color-text-rgb)/0.85)] transition hover:bg-[var(--color-card)] hover:shadow-md"
                >
                  <RotateCcw className="h-4 w-4" />
                  Today
                </button>

                <button
                  type="button"
                  onClick={() => changeMonth(1)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-card-hover)] text-[rgb(var(--color-text-rgb)/0.78)] transition hover:bg-[var(--color-card)] hover:text-[rgb(var(--color-text-rgb)/0.95)]"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Weekday header */}
          <div className="border-b border-[var(--color-border)] bg-[rgb(var(--color-surface-rgb)/0.22)] px-3 pt-3 sm:px-4">
            <div className="grid grid-cols-7 gap-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div
                  key={d}
                  className="rounded-xl px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.54)] sm:text-[11px]"
                >
                  {d}
                </div>
              ))}
            </div>
          </div>

          {/* Calendar grid */}
          <div className="bg-[rgb(var(--color-surface-rgb)/0.22)] p-3 sm:p-4">
            <div className="grid grid-cols-7 gap-2">
              {/* Previous-month leading cells */}
              {(() => {
                const first = getMonthStart(month);
                const leadingBlanks = first.getDay();
                const previousMonthLastDay = new Date(
                  month.getFullYear(),
                  month.getMonth(),
                  0
                ).getDate();

                return Array.from({ length: leadingBlanks }).map((_, i) => {
                  const dayNumber =
                    previousMonthLastDay - leadingBlanks + i + 1;

                  return (
                    <div
                      key={`prev-${i}`}
                      className="min-h-[82px] rounded-xl border border-[rgb(var(--color-border-rgb)/0.08)] bg-[rgb(var(--color-background-rgb)/0.18)] px-2 py-2 text-left opacity-55 sm:min-h-[116px] sm:px-3 sm:py-3"
                    >
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold text-[rgb(var(--color-text-rgb)/0.26)]">
                        {dayNumber}
                      </span>
                    </div>
                  );
                });
              })()}

              {/* Current-month days */}
              {days.map((d) => {
                const key = toYMD(d);
                const dayCounts = counts.get(key) ?? makeEmptyDayCounts();
                const isToday = toYMD(d) === toYMD(new Date());

                const dayTotal =
                  dayCounts.felt + dayCounts.shingles + dayCounts.punch;

                const hasAnything = dayTotal > 0;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => navigate(`/schedule/${key}`)}
                    className={[
                      "group relative min-h-[82px] w-full overflow-hidden rounded-xl border px-2 py-2 text-left text-xs transition sm:min-h-[116px] sm:px-3 sm:py-3",
                      "border-[rgb(var(--color-border-rgb)/0.14)] bg-[var(--color-card)] shadow-[0_10px_24px_rgba(0,0,0,0.06)]",
                      "hover:-translate-y-0.5 hover:border-[rgb(var(--color-border-rgb)/0.24)] hover:bg-[var(--color-card-hover)] hover:shadow-[0_16px_34px_rgba(0,0,0,0.14)]",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-gold)]/60",
                      isToday
                        ? "border-[var(--color-accent-gold)]/35 bg-[rgb(var(--color-surface-rgb)/0.48)]"
                        : "",
                      hasAnything
                        ? "ring-1 ring-[rgb(var(--color-border-rgb)/0.08)]"
                        : "",
                    ].join(" ")}
                  >
                    {hasAnything && (
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-[var(--color-accent-gold)]/70" />
                    )}

                    <div className="relative flex items-start justify-between gap-2">
                      <span
                        className={[
                          "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold transition",
                          isToday
                            ? "border border-[var(--color-accent-gold)]/45 bg-[var(--color-accent-gold)]/15 text-[var(--color-accent-gold)]"
                            : "text-[rgb(var(--color-text-rgb)/0.90)] group-hover:bg-[rgb(var(--color-surface-rgb)/0.58)]",
                        ].join(" ")}
                      >
                        {d.getDate()}
                      </span>

                      {hasAnything && (
                        <span className="rounded-full border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-2 py-0.5 text-[10px] font-semibold text-[rgb(var(--color-text-rgb)/0.72)]">
                          {dayTotal}
                        </span>
                      )}
                    </div>

                    {hasAnything ? (
                      <div className="mt-3 space-y-1.5">
                        {dayCounts.felt > 0 && (
                          <div className="flex items-center justify-between gap-2 rounded-full border border-sky-400/25 bg-sky-400/10 px-2 py-1 text-[10px] font-semibold text-sky-300">
                            <span className="truncate">Dry-in</span>
                            <span>{dayCounts.felt}</span>
                          </div>
                        )}

                        {dayCounts.shingles > 0 && (
                          <div className="flex items-center justify-between gap-2 rounded-full border border-[var(--color-accent-gold)]/30 bg-[var(--color-accent-gold)]/10 px-2 py-1 text-[10px] font-semibold text-[var(--color-accent-gold)]">
                            <span className="truncate">Shingles</span>
                            <span>{dayCounts.shingles}</span>
                          </div>
                        )}

                        {dayCounts.punch > 0 && (
                          <div className="flex items-center justify-between gap-2 rounded-full border border-[rgb(var(--pill-success-rgb)/0.30)] bg-[rgb(var(--pill-success-rgb)/0.12)] px-2 py-1 text-[10px] font-semibold text-[rgb(var(--pill-success-rgb))]">
                            <span className="truncate">Punch</span>
                            <span>{dayCounts.punch}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 hidden text-[11px] text-[rgb(var(--color-text-rgb)/0.34)] transition group-hover:text-[rgb(var(--color-text-rgb)/0.50)] sm:block">
                        No scheduled work
                      </div>
                    )}
                  </button>
                );
              })}

              {/* Next-month trailing cells */}
              {(() => {
                const first = getMonthStart(month);
                const leadingBlanks = first.getDay();
                const totalRendered = leadingBlanks + days.length;
                const trailingBlanks = (7 - (totalRendered % 7)) % 7;

                return Array.from({ length: trailingBlanks }).map((_, i) => {
                  const dayNumber = i + 1;

                  return (
                    <div
                      key={`next-${i}`}
                      className="min-h-[82px] rounded-xl border border-[rgb(var(--color-border-rgb)/0.08)] bg-[rgb(var(--color-background-rgb)/0.18)] px-2 py-2 text-left opacity-55 sm:min-h-[116px] sm:px-3 sm:py-3"
                    >
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold text-[rgb(var(--color-text-rgb)/0.26)]">
                        {dayNumber}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
          {/* Footer note */}
          <div className="border-t border-[var(--color-border)] bg-[rgb(var(--color-surface-rgb)/0.28)] px-4 py-3 sm:px-6">
            <div className="flex flex-col gap-2 text-[11px] text-[rgb(var(--color-text-rgb)/0.55)] sm:flex-row sm:items-center sm:justify-between">
              <span>
                Calendar counts are pulled from scheduled dry-in, shingles, and
                punch dates.
              </span>

              <span className="font-semibold text-[rgb(var(--color-text-rgb)/0.72)]">
                Click any day to open its schedule.
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
