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

function getScheduleRows(dayCounts: DayCounts) {
  return [
    {
      key: "felt",
      label: "Dry-in",
      shortLabel: "D",
      count: dayCounts.felt,
      className: "border-sky-400/25 bg-sky-400/10 text-sky-300",
      dotClassName: "bg-sky-300",
    },
    {
      key: "shingles",
      label: "Shingles",
      shortLabel: "S",
      count: dayCounts.shingles,
      className:
        "border-[var(--color-accent-gold)]/30 bg-[var(--color-accent-gold)]/10 text-[var(--color-accent-gold)]",
      dotClassName: "bg-white",
    },
    {
      key: "punch",
      label: "Punch",
      shortLabel: "P",
      count: dayCounts.punch,
      className:
        "border-[rgb(var(--pill-success-rgb)/0.30)] bg-[rgb(var(--pill-success-rgb)/0.12)] text-[rgb(var(--pill-success-rgb))]",
      dotClassName: "bg-[rgb(var(--pill-success-rgb))]",
    },
  ].filter((row) => row.count > 0);
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

  const leadingBlankCount = getMonthStart(month).getDay();
  const previousMonthLastDay = new Date(
    month.getFullYear(),
    month.getMonth(),
    0
  ).getDate();
  const totalRenderedBeforeTrailing = leadingBlankCount + days.length;
  const trailingBlankCount = (7 - (totalRenderedBeforeTrailing % 7)) % 7;
  const calendarWeeks = Math.ceil(
    (totalRenderedBeforeTrailing + trailingBlankCount) / 7
  );

  return (
    <div className="rz-dashboard-shell h-[calc(100dvh-72px-3rem)] w-full overflow-hidden text-[var(--color-text)] bg-gradient-to-b from-[var(--color-background)] to-[var(--color-card)] sm:h-[calc(100dvh-72px-4rem)]">
      <div className="mx-auto flex h-full w-full max-w-[1280px] flex-col px-3 sm:px-5 lg:px-6">
        {/* Calendar shell */}
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm hover:shadow-md">
          {/* Header */}
          <div className="shrink-0 border-b border-[var(--color-border)] px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-lg font-semibold tracking-wide text-[var(--color-text)] sm:text-xl">
                    {monthLabel}
                  </h1>

                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-[rgb(var(--color-text-rgb)/0.66)] sm:text-[11px]">
                    Live schedule
                  </span>

                  <span className="rounded-full border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-2.5 py-0.5 text-[10px] font-semibold text-[rgb(var(--color-text-rgb)/0.72)] sm:text-[11px]">
                    {totalScheduledThisMonth} jobs
                  </span>
                </div>

                {/* Summary pills */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] sm:text-[11px]">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 py-0.5 font-semibold text-sky-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />
                    Dry-in: {monthTotals.felt}
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-accent-gold)]/30 bg-[var(--color-accent-gold)]/10 px-2.5 py-0.5 font-semibold text-[var(--color-accent-gold)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    Shingles: {monthTotals.shingles}
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--pill-success-rgb)/0.30)] bg-[rgb(var(--pill-success-rgb)/0.12)] px-2.5 py-0.5 font-semibold text-[rgb(var(--pill-success-rgb))]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--pill-success-rgb))]" />
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
          <div className="shrink-0 border-b border-[var(--color-border)] bg-[rgb(var(--color-surface-rgb)/0.22)] px-2 py-1.5 sm:px-3">
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div
                  key={d}
                  className="rounded-lg px-1 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.54)] sm:text-[11px]"
                >
                  {d}
                </div>
              ))}
            </div>
          </div>

          {/* Calendar grid */}
          <div className="min-h-0 flex-1 bg-[rgb(var(--color-surface-rgb)/0.22)] p-2 sm:p-3">
            <div
              className="grid h-full grid-cols-7 gap-1.5 sm:gap-2"
              style={{
                gridTemplateRows: `repeat(${calendarWeeks}, minmax(0, 1fr))`,
              }}
            >
              {/* Previous-month leading cells */}
              {Array.from({ length: leadingBlankCount }).map((_, i) => {
                const dayNumber = previousMonthLastDay - leadingBlankCount + i + 1;

                return (
                  <div
                    key={`prev-${i}`}
                    className="h-full min-h-0 rounded-xl border border-[rgb(var(--color-border-rgb)/0.08)] bg-[rgb(var(--color-background-rgb)/0.18)] px-2 py-1.5 text-left opacity-55 sm:px-3 sm:py-2"
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold text-[rgb(var(--color-text-rgb)/0.26)] sm:h-6 sm:w-6 sm:text-xs">
                      {dayNumber}
                    </span>
                  </div>
                );
              })}

              {/* Current-month days */}
              {days.map((d) => {
                const key = toYMD(d);
                const dayCounts = counts.get(key) ?? makeEmptyDayCounts();
                const isToday = toYMD(d) === toYMD(new Date());
                const dayTotal =
                  dayCounts.felt + dayCounts.shingles + dayCounts.punch;
                const hasAnything = dayTotal > 0;
                const scheduleRows = getScheduleRows(dayCounts);

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => navigate(`/schedule/${key}`)}
                    className={[
                      "group relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border px-2 py-1.5 text-left text-xs transition sm:px-3 sm:py-2",
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
                          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition sm:h-6 sm:w-6 sm:text-xs",
                          isToday
                            ? "border border-[var(--color-accent-gold)]/45 bg-[var(--color-accent-gold)]/15 text-[var(--color-accent-gold)]"
                            : "text-[rgb(var(--color-text-rgb)/0.90)] group-hover:bg-[rgb(var(--color-surface-rgb)/0.58)]",
                        ].join(" ")}
                      >
                        {d.getDate()}
                      </span>

                      {hasAnything && (
                        <span className="rounded-full border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-1.5 py-0 text-[9px] font-semibold text-[rgb(var(--color-text-rgb)/0.72)] sm:text-[10px]">
                          {dayTotal}
                        </span>
                      )}
                    </div>

                    {hasAnything ? (
                      <div className="mt-auto grid grid-cols-3 gap-1 pt-1.5">
                        {scheduleRows.map((row) => (
                          <div
                            key={row.key}
                            className={`flex h-[22px] min-w-0 items-center justify-center gap-1 rounded-md border px-1 text-[10px] font-bold leading-none sm:h-[24px] ${row.className}`}
                            title={`${row.label}: ${row.count}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${row.dotClassName}`}
                            />
                            <span className="shrink-0">{row.shortLabel}</span>
                            <span className="shrink-0 opacity-90">{row.count}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-auto hidden text-[10px] text-[rgb(var(--color-text-rgb)/0.34)] transition group-hover:text-[rgb(var(--color-text-rgb)/0.50)] xl:block">
                        No scheduled work
                      </div>
                    )}

                    {hasAnything && (
                      <div className="pointer-events-none absolute inset-1 z-20 flex flex-col rounded-lg border border-[rgb(var(--color-border-rgb)/0.24)] bg-[rgb(var(--color-background-rgb)/0.94)] p-1.5 opacity-0 shadow-xl ring-1 ring-black/10 transition duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                        <div className="flex h-3.5 shrink-0 items-center justify-between gap-2 text-[9px] font-bold leading-none text-[rgb(var(--color-text-rgb)/0.88)]">
                          <span className="truncate">
                            {d.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="shrink-0 text-[rgb(var(--color-text-rgb)/0.62)]">
                            {dayTotal} total
                          </span>
                        </div>

                        <div className="mt-1 grid min-h-0 flex-1 gap-0.5">
                          {scheduleRows.map((row) => (
                            <div
                              key={`preview-${row.key}`}
                              className="flex min-h-0 items-center justify-between gap-2 rounded-md bg-[rgb(var(--color-surface-rgb)/0.32)] px-1.5 py-0.5 text-[9px] font-semibold text-[rgb(var(--color-text-rgb)/0.88)] sm:text-[10px]"
                            >
                              <span className="inline-flex min-w-0 items-center gap-1.5">
                                <span
                                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${row.dotClassName}`}
                                />
                                <span className="truncate">{row.label}</span>
                              </span>
                              <span className="shrink-0">{row.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}

              {/* Next-month trailing cells */}
              {Array.from({ length: trailingBlankCount }).map((_, i) => {
                const dayNumber = i + 1;

                return (
                  <div
                    key={`next-${i}`}
                    className="h-full min-h-0 rounded-xl border border-[rgb(var(--color-border-rgb)/0.08)] bg-[rgb(var(--color-background-rgb)/0.18)] px-2 py-1.5 text-left opacity-55 sm:px-3 sm:py-2"
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold text-[rgb(var(--color-text-rgb)/0.26)] sm:h-6 sm:w-6 sm:text-xs">
                      {dayNumber}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
