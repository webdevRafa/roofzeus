import { useEffect, useMemo, useRef, useState } from "react";

import { AnimatePresence, motion, type Variants } from "framer-motion";

import CountUp from "react-countup";

import type { Job, JobStatus } from "../types/types";
import { useOrgJobsData } from "../hooks/useOrgJobsData";
import { DashboardJobsSection } from "../features/dashboard/DashboardJobsSection";

// Chart.js imports for summary visualisations
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title as ChartTitle,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  type ChartData,
  type ChartOptions,
  type TooltipItem,
} from "chart.js";
import { Bar, Pie } from "react-chartjs-2";
import { Briefcase, SlidersHorizontal } from "lucide-react";

// Register chart modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  ChartTitle,
  ChartTooltip,
  ChartLegend
);

/* Small helpers matching DashboardPage */
type FsTimestampLike = { toDate: () => Date };
function isFsTimestamp(x: unknown): x is FsTimestampLike {
  return typeof (x as FsTimestampLike)?.toDate === "function";
}
function toMillis(x: unknown): number | null {
  if (x == null) return null;
  if (x instanceof Date) return x.getTime();
  if (typeof x === "number") return x;
  if (isFsTimestamp(x)) return x.toDate().getTime();
  if (typeof x === "string") {
    const d = new Date(x);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  return null;
}

type StatusFilter = "all" | JobStatus;

/** Pick a displayable address line from a Job's address. */
function pickAddressLine(a: Job["address"]): string {
  if (typeof a === "string") return a;
  return a?.fullLine ?? "";
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
const ease = [0.16, 1, 0.3, 1] as const;

const stagger: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.03 },
  },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.55, ease },
  },
};

export default function JobsPage() {
  // Consolidated hook providing org context, job lists, filters, and a job creation helper.
  const {
    orgId,
    membershipLoading,
    jobs,
    employees,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    setDatePreset,
    searchTerm,
    setSearchTerm,
    jobsPage,
    setJobsPage,
    JOBS_PER_PAGE,
    openForm,
    setOpenForm,
    address,
    setAddress,
    newFeltDate,
    setNewFeltDate,
    newShinglesDate,
    setNewShinglesDate,
    newPunchDate,
    setNewPunchDate,
    assignedEmployeeIds,
    setAssignedEmployeeIds,
    filteredJobs,
    applyPreset,
    createJob,
    hasActiveDateFilter,
    rangeLabel,
  } = useOrgJobsData();

  // Additional UI state not managed by the hook.
  // showSearch and showFilters control visibility of the search and filter panels.
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Controls whether the jobs section is expanded.
  const [jobsOpen, setJobsOpen] = useState(true);

  // Sort option state (recent, highest net, lowest net).
  const [sortOption, setSortOption] = useState<"recent" | "netDesc" | "netAsc">(
    "recent"
  );

  // Floating sort (pinned when header scrolls away)
  const sortSentinelRef = useRef<HTMLDivElement | null>(null);
  const [sortPinned, setSortPinned] = useState(false);
  const [mobileSortOpen, setMobileSortOpen] = useState(false);

  useEffect(() => {
    if (!sortPinned) setMobileSortOpen(false);
  }, [sortPinned]);

  useEffect(() => {
    const el = sortSentinelRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        // If sentinel is NOT visible, we are scrolled past the header -> pin sort
        setSortPinned(!entry.isIntersecting);
      },
      { root: null, threshold: 0 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Active employees subscription is handled by useOrgJobsData

  // createJob is provided by useOrgJobsData

  // filteredJobs is provided by useOrgJobsData

  // Sort filtered jobs based on selected option
  const sortedJobs = useMemo(() => {
    const arr = [...filteredJobs];
    if (sortOption === "netDesc") {
      return arr.sort(
        (a, b) =>
          (b.computed?.netProfitCents ?? 0) - (a.computed?.netProfitCents ?? 0)
      );
    } else if (sortOption === "netAsc") {
      return arr.sort(
        (a, b) =>
          (a.computed?.netProfitCents ?? 0) - (b.computed?.netProfitCents ?? 0)
      );
    } else {
      // default: most recent updatedAt
      return arr.sort((a, b) => {
        const aTs = toMillis(a.updatedAt ?? a.createdAt) ?? 0;
        const bTs = toMillis(b.updatedAt ?? b.createdAt) ?? 0;
        return bTs - aTs;
      });
    }
  }, [filteredJobs, sortOption]);

  // Pagination & totals based on sorted jobs
  const jobsTotalPages = Math.max(
    1,
    Math.ceil(sortedJobs.length / JOBS_PER_PAGE)
  );
  const pagedJobs = useMemo(() => {
    const start = (jobsPage - 1) * JOBS_PER_PAGE;
    return sortedJobs.slice(start, start + JOBS_PER_PAGE);
  }, [sortedJobs, jobsPage]);
  const totalNet = useMemo(
    () =>
      sortedJobs.reduce((acc, j) => acc + (j.computed?.netProfitCents ?? 0), 0),
    [sortedJobs]
  );
  const totalEarnings = useMemo(
    () =>
      sortedJobs.reduce(
        (acc, j) => acc + (j.earnings?.totalEarningsCents ?? 0),
        0
      ),
    [sortedJobs]
  );
  const totalExpenses = useMemo(
    () =>
      sortedJobs.reduce(
        (acc, j) => acc + (j.computed?.totalExpensesCents ?? 0),
        0
      ),
    [sortedJobs]
  );
  const averageProfit = useMemo(
    () => (sortedJobs.length > 0 ? totalNet / sortedJobs.length : 0),
    [totalNet, sortedJobs.length]
  );
  const highestProfit = useMemo(() => {
    let max = 0;
    sortedJobs.forEach((j) => {
      const n = j.computed?.netProfitCents ?? 0;
      if (n > max) max = n;
    });
    return max;
  }, [sortedJobs]);

  // Build filters dynamically from statuses present
  const dynamicStatusOptions: JobStatus[] = useMemo(() => {
    const set = new Set<JobStatus>();
    jobs.forEach((j) => set.add(j.status));
    return Array.from(set);
  }, [jobs]);
  const filters: StatusFilter[] = ["all", ...dynamicStatusOptions];

  // Date presets, applyPreset, hasActiveDateFilter and rangeLabel are provided by useOrgJobsData

  // Compute status counts across all jobs (unfiltered) for summary
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    jobs.forEach((j) => {
      counts[j.status] = (counts[j.status] ?? 0) + 1;
    });
    return counts;
  }, [jobs]);

  // ---------------------------
  // Chart styling (dark theme)
  // ---------------------------
  const GRID = "rgba(245,246,248,0.10)";
  const TICK = "rgba(245,246,248,0.60)";
  const LEGEND = "rgba(245,246,248,0.70)";
  const TOOLTIP_BG = "rgba(11,14,20,0.92)";
  const TOOLTIP_BORDER = "rgba(58,63,75,0.85)";

  // Chart: status distribution
  const statusLabels = useMemo(() => Object.keys(statusCounts), [statusCounts]);
  const statusValues = useMemo(
    () => statusLabels.map((l) => statusCounts[l] ?? 0),
    [statusLabels, statusCounts]
  );
  const statusColors = useMemo(() => {
    const palette = [
      "rgba(207,174,93,0.95)", // gold
      "rgba(52,211,153,0.90)", // green
      "rgba(106,169,255,0.90)", // blue
      "rgba(192,132,252,0.85)", // purple
      "rgba(248,113,113,0.85)", // red
      "rgba(250,204,21,0.85)", // amber
      "rgba(129,140,248,0.85)", // indigo
      "rgba(244,114,182,0.85)", // pink
    ];
    return statusLabels.map((_, idx) => palette[idx % palette.length]);
  }, [statusLabels]);

  const statusChartData: ChartData<"pie", number[], string> = {
    labels: statusLabels,
    datasets: [
      {
        label: "Jobs by Status",
        data: statusValues,
        backgroundColor: statusColors,
        borderWidth: 1,
        borderColor: "rgba(31,36,48,0.55)",
      },
    ],
  };

  const statusChartOptions: ChartOptions<"pie"> = {
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          boxWidth: 10,
          boxHeight: 10,
          color: LEGEND,
          font: { size: 11 },
          padding: 14,
        },
      },
      title: { display: false },
      tooltip: {
        backgroundColor: TOOLTIP_BG,
        borderColor: TOOLTIP_BORDER,
        borderWidth: 1,
        titleColor: "rgba(245,246,248,0.92)",
        bodyColor: "rgba(245,246,248,0.85)",
        padding: 10,
      },
    },
  };

  // Chart: top jobs by net profit
  const topJobs = useMemo(() => {
    const arr = [...sortedJobs];
    arr.sort(
      (a, b) =>
        (b.computed?.netProfitCents ?? 0) - (a.computed?.netProfitCents ?? 0)
    );
    return arr.slice(0, 5);
  }, [sortedJobs]);

  const topJobLabels = topJobs.map((j) => {
    const line = pickAddressLine(j.address);
    return line.length > 30 ? line.slice(0, 27) + "…" : line;
  });
  const topJobValues = topJobs.map(
    (j) => (j.computed?.netProfitCents ?? 0) / 100
  );

  const topJobsData: ChartData<"bar", number[], string> = {
    labels: topJobLabels,
    datasets: [
      {
        label: "Net Profit ($)",
        data: topJobValues,
        backgroundColor: "rgba(207,174,93,0.55)",
        borderColor: "rgba(207,174,93,0.90)",
        borderWidth: 1,
        borderRadius: 10,
      },
    ],
  };

  const topJobsOptions: ChartOptions<"bar"> = {
    indexAxis: "y",
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: TOOLTIP_BG,
        borderColor: TOOLTIP_BORDER,
        borderWidth: 1,
        titleColor: "rgba(245,246,248,0.92)",
        bodyColor: "rgba(245,246,248,0.85)",
        padding: 10,
        callbacks: {
          label: (context: TooltipItem<"bar">) => {
            const value = context.parsed.x;
            return `$${Number(value).toFixed(2)}`;
          },
        },
      },
      title: { display: false },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: GRID },
        ticks: { color: TICK, callback: (v) => `$${v}` },
      },
      y: {
        grid: { color: "transparent" },
        ticks: { color: TICK, autoSkip: false },
      },
    },
  };

  // Guard: show loading or no org message
  const isBusy = membershipLoading;
  const hasOrg = Boolean(orgId);
  if (isBusy)
    return (
      <div className="p-6 text-sm" style={{ color: "var(--color-muted)" }}>
        Loading organization…
      </div>
    );
  if (!hasOrg)
    return (
      <div className="p-6 text-sm" style={{ color: "var(--color-muted)" }}>
        You are not linked to an organization. Please contact your admin.
      </div>
    );

  // Derived KPIs
  const totalJobs = sortedJobs.length;

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto w-[min(1200px,94vw)] space-y-8 py-8">
        {/* Page header */}
        <section
          className="relative overflow-visible rounded-2xl border px-5 sm:px-6 py-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "rgba(31,36,48,0.55)",
          }}
        >
          <div
            className="pointer-events-none absolute -top-28 -right-28 h-72 w-72 rounded-full blur-3xl"
            style={{ backgroundColor: "rgba(207,174,93,0.10)" }}
          />
          <div
            className="pointer-events-none absolute -bottom-28 -left-28 h-72 w-72 rounded-full blur-3xl"
            style={{ backgroundColor: "rgba(245,246,248,0.06)" }}
          />

          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-xl border flex items-center justify-center"
                  style={{
                    backgroundColor: "rgba(11,14,20,0.55)",
                    borderColor: "rgba(58,63,75,0.9)",
                  }}
                >
                  <Briefcase
                    className="h-5 w-5"
                    style={{ color: "var(--color-accent-gold)" }}
                  />
                </div>

                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-semibold text-white">
                    Jobs
                  </h1>
                  <p
                    className="mt-1 text-xs sm:text-[13px]"
                    style={{ color: "var(--color-muted)" }}
                  >
                    Review performance, audit margin, and manage job pipeline —
                    org scoped.
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/60">
                  Showing:{" "}
                  <span className="ml-1 font-semibold text-white/85">
                    {totalJobs}
                  </span>
                </span>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/60">
                  Sort:{" "}
                  <span className="ml-1 font-semibold text-white/85">
                    {sortOption === "recent"
                      ? "Most recent"
                      : sortOption === "netDesc"
                      ? "Highest net"
                      : "Lowest net"}
                  </span>
                </span>
                {hasActiveDateFilter ? (
                  <span className="inline-flex items-center rounded-full border border-[var(--color-accent-gold)]/25 bg-[var(--color-accent-gold)]/10 px-3 py-1 text-[var(--color-accent-gold)]/85">
                    Date: {rangeLabel || "Custom range"}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/60">
                    Date: All time
                  </span>
                )}
              </div>
            </div>

            {/* Sort control (kept same logic) */}
            <div className="flex items-center gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-white/60" />
                  <label className="text-xs font-semibold text-white/70">
                    Sort
                  </label>
                </div>

                <SortMenu
                  key={`pinned-${sortOption}`}
                  value={sortOption}
                  onChange={(v) => setSortOption(v)}
                />
              </div>
            </div>
          </div>
          <div ref={sortSentinelRef} className="h-px w-full" />
        </section>

        <AnimatePresence>
          {sortPinned && (
            <>
              {/* ✅ Desktop pinned bar (unchanged behavior) */}
              <motion.div
                initial={{ opacity: 0, y: -12, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
                transition={{ duration: 0.22, ease }}
                className="fixed right-4 top-20 z-[300] hidden md:block"
              >
                <div
                  className="rounded-2xl border px-3 py-2 shadow-[0_22px_60px_rgba(0,0,0,0.65)] backdrop-blur"
                  style={{
                    borderColor: "rgba(58,63,75,0.85)",
                    backgroundColor: "rgba(11,14,20,0.70)",
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-white/60" />
                      <label className="text-xs font-semibold text-white/70">
                        Sort
                      </label>
                    </div>

                    <SortMenu
                      key={`desk-pinned-${sortOption}`}
                      value={sortOption}
                      onChange={(v) => setSortOption(v)}
                    />
                  </div>

                  <div className="mt-1 text-[11px] text-white/45">
                    Sorting:{" "}
                    <span className="font-semibold text-white/70">
                      {sortOption === "recent"
                        ? "Most recent"
                        : sortOption === "netDesc"
                        ? "Highest net"
                        : "Lowest net"}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* ✅ Mobile floating FAB + popover (no navbar conflict) */}
              <motion.div
                initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: 14, filter: "blur(6px)" }}
                transition={{ duration: 0.22, ease }}
                className="fixed bottom-4 right-4 z-[300] md:hidden"
              >
                <div className="relative">
                  {/* Popover */}
                  <AnimatePresence>
                    {mobileSortOpen && (
                      <motion.div
                        initial={{
                          opacity: 0,
                          y: 8,
                          scale: 0.985,
                          filter: "blur(6px)",
                        }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          scale: 1,
                          filter: "blur(0px)",
                        }}
                        exit={{
                          opacity: 0,
                          y: 8,
                          scale: 0.985,
                          filter: "blur(6px)",
                        }}
                        transition={{ duration: 0.18, ease }}
                        className="absolute bottom-14 right-0 w-[min(92vw,320px)]"
                      >
                        <div
                          className="rounded-2xl border p-3 shadow-[0_22px_60px_rgba(0,0,0,0.65)] backdrop-blur"
                          style={{
                            borderColor: "rgba(58,63,75,0.9)",
                            backgroundColor: "rgba(11,14,20,0.90)",
                          }}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <div className="inline-flex items-center gap-2">
                              <SlidersHorizontal className="h-4 w-4 text-white/60" />
                              <div className="text-xs font-semibold text-white/80">
                                Sort jobs
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setMobileSortOpen(false)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70"
                            >
                              Close
                            </button>
                          </div>

                          {/* Reuse existing themed dropdown */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[11px] text-white/50">
                              Current
                            </div>
                            <SortMenu
                              key={`mob-pinned-${sortOption}`}
                              value={sortOption}
                              onChange={(v) => setSortOption(v)}
                            />
                          </div>

                          <div className="mt-2 text-[11px] text-white/45">
                            Sorting:{" "}
                            <span className="font-semibold text-white/70">
                              {sortOption === "recent"
                                ? "Most recent"
                                : sortOption === "netDesc"
                                ? "Highest net"
                                : "Lowest net"}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* FAB button */}
                  <button
                    type="button"
                    onClick={() => setMobileSortOpen((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-full border px-4 py-3 text-xs font-semibold shadow-[0_18px_40px_rgba(0,0,0,0.55)]"
                    style={{
                      borderColor: "rgba(58,63,75,0.85)",
                      backgroundColor: "rgba(11,14,20,0.80)",
                      color: "rgba(245,246,248,0.92)",
                    }}
                    aria-label="Sort jobs"
                  >
                    <SlidersHorizontal className="h-4 w-4 text-white/70" />
                    Sort
                    <span className="text-white/50">
                      •{" "}
                      {sortOption === "recent"
                        ? "Recent"
                        : sortOption === "netDesc"
                        ? "High net"
                        : "Low net"}
                    </span>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Overview KPIs + charts */}
        <section
          className="rounded-2xl border p-4 sm:p-5 shadow-[0_18px_50px_rgba(0,0,0,0.35)]"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "rgba(31,36,48,0.55)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-white/90">
              Jobs Overview
            </h2>
            <span
              className="text-[11px]"
              style={{ color: "var(--color-muted)" }}
            >
              Totals reflect current filters + sort
            </span>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
          >
            <KpiCard label="Total jobs" value={totalJobs} kind="int" />
            <KpiCard
              label="Total earnings"
              value={totalEarnings}
              kind="cents"
              accent="gold"
            />
            <KpiCard
              label="Total expenses"
              value={totalExpenses}
              kind="cents"
            />
            <KpiCard
              label="Net profit"
              value={totalNet}
              kind="cents"
              accent={totalNet >= 0 ? "green" : "red"}
            />
            <KpiCard
              label="Avg. profit/job"
              value={Math.round(averageProfit)}
              kind="cents"
            />
            <KpiCard
              label="Highest profit"
              value={highestProfit}
              kind="cents"
            />
          </motion.div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div
              className="rounded-2xl border p-4"
              style={{
                borderColor: "rgba(58,63,75,0.75)",
                backgroundColor: "rgba(11,14,20,0.35)",
              }}
            >
              <h3 className="mb-2 text-sm font-semibold text-white/90">
                Job Status Distribution
              </h3>
              <div className="relative h-64 w-full">
                <Pie data={statusChartData} options={statusChartOptions} />
              </div>
              <p
                className="mt-2 text-[12px]"
                style={{ color: "var(--color-muted)" }}
              >
                Use this to spot bottlenecks (e.g., too many pending or invoiced
                jobs).
              </p>
            </div>

            <div
              className="rounded-2xl border p-4"
              style={{
                borderColor: "rgba(58,63,75,0.75)",
                backgroundColor: "rgba(11,14,20,0.35)",
              }}
            >
              <h3 className="mb-2 text-sm font-semibold text-white/90">
                Top Jobs by Profit
              </h3>
              <div className="relative h-64 w-full">
                <Bar data={topJobsData} options={topJobsOptions} />
              </div>
              <p
                className="mt-2 text-[12px]"
                style={{ color: "var(--color-muted)" }}
              >
                Great for identifying high-margin patterns you can repeat.
              </p>
            </div>
          </div>
        </section>

        {/* Status summary */}
        <section
          className="rounded-2xl border p-4 sm:p-5 shadow-[0_18px_50px_rgba(0,0,0,0.35)]"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "rgba(31,36,48,0.55)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-white/90">
              Job Status Summary
            </h2>
            <span
              className="text-[11px]"
              style={{ color: "var(--color-muted)" }}
            >
              Counts across all jobs in org
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div
                key={status}
                className="rounded-xl border p-3"
                style={{
                  borderColor: "rgba(58,63,75,0.75)",
                  backgroundColor: "rgba(11,14,20,0.30)",
                }}
              >
                <div className="text-[11px] uppercase tracking-wide text-white/55">
                  {status}
                </div>
                <div className="mt-1 text-xl font-semibold text-white">
                  {count}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pipeline list section (uses your upgraded DashboardJobsSection exactly as-is) */}
        <section className="mt-2">
          <DashboardJobsSection
            jobsOpen={jobsOpen}
            setJobsOpen={setJobsOpen}
            showSearch={showSearch}
            setShowSearch={setShowSearch}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            hasActiveDateFilter={hasActiveDateFilter}
            rangeLabel={rangeLabel}
            setDatePreset={setDatePreset}
            startDate={startDate}
            endDate={endDate}
            setStartDate={setStartDate}
            setEndDate={setEndDate}
            applyPreset={applyPreset}
            employees={employees}
            assignedEmployeeIds={assignedEmployeeIds}
            setAssignedEmployeeIds={setAssignedEmployeeIds}
            filters={filters}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            newFeltDate={newFeltDate}
            setNewFeltDate={setNewFeltDate}
            newShinglesDate={newShinglesDate}
            setNewShinglesDate={setNewShinglesDate}
            newPunchDate={newPunchDate}
            setNewPunchDate={setNewPunchDate}
            openForm={openForm}
            setOpenForm={setOpenForm}
            address={address}
            setAddress={setAddress}
            createJob={createJob}
            loading={loading}
            error={error}
            filteredJobs={sortedJobs}
            pagedJobs={pagedJobs}
            jobsPage={jobsPage}
            jobsTotalPages={jobsTotalPages}
            setJobsPage={setJobsPage}
            JOBS_PER_PAGE={JOBS_PER_PAGE}
            totalNet={totalNet}
          />
        </section>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  kind,
  accent,
}: {
  label: string;
  value: number;
  kind: "int" | "cents";
  accent?: "gold" | "green" | "red";
}) {
  const accentCls =
    accent === "gold"
      ? "text-[var(--color-accent-gold)]"
      : accent === "green"
      ? "text-emerald-200"
      : accent === "red"
      ? "text-red-200"
      : "text-white";

  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -2, transition: { duration: 0.22, ease } }}
      className="rounded-2xl border px-4 py-3"
      style={{
        borderColor: "rgba(58,63,75,0.75)",
        backgroundColor: "rgba(11,14,20,0.30)",
      }}
    >
      <div className="text-[11px] uppercase tracking-wide text-white/55">
        {label}
      </div>

      <div className={cx("mt-1 text-lg font-semibold tabular-nums", accentCls)}>
        {kind === "int" ? (
          <CountUp start={0} end={value} duration={0.9} separator="," />
        ) : (
          <>
            $
            <CountUp
              start={0}
              end={value / 100}
              duration={0.9}
              decimals={2}
              separator=","
              decimal="."
            />
          </>
        )}
      </div>
    </motion.div>
  );
}

function SortMenu({
  value,
  onChange,
}: {
  value: "recent" | "netDesc" | "netAsc";
  onChange: (v: "recent" | "netDesc" | "netAsc") => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const options: Array<{
    value: "recent" | "netDesc" | "netAsc";
    label: string;
    hint: string;
  }> = [
    { value: "recent", label: "Most recent", hint: "Latest updates first" },
    {
      value: "netDesc",
      label: "Highest net profit",
      hint: "Top margin jobs first",
    },
    {
      value: "netAsc",
      label: "Lowest net profit",
      hint: "Find weak jobs fast",
    },
  ];

  const active = options.find((o) => o.value === value) ?? options[0];

  // close on click outside
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node | null;
      if (!t) return;
      if (btnRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  // close on escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const ease = [0.16, 1, 0.3, 1] as const;

  return (
    <div className="relative">
      <motion.button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((s) => !s)}
        whileTap={{ scale: 0.98 }}
        className="group inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold outline-none transition"
        style={{
          borderColor: open ? "rgba(207,174,93,0.55)" : "rgba(58,63,75,0.85)",
          backgroundColor: "rgba(11,14,20,0.55)",
          color: "rgba(245,246,248,0.92)",
          boxShadow: open ? "0 0 0 3px rgba(207,174,93,0.18)" : "none",
        }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="whitespace-nowrap">{active.label}</span>

        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18, ease }}
          className="text-white/60"
          aria-hidden="true"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
              clipRule="evenodd"
            />
          </svg>
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 8, scale: 0.985, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 10, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 8, scale: 0.985, filter: "blur(6px)" }}
            transition={{ duration: 0.18, ease }}
            className="absolute right-0 z-50 mt-2 w-[240px] overflow-hidden rounded-2xl border shadow-[0_22px_60px_rgba(0,0,0,0.65)]"
            style={{
              borderColor: "rgba(58,63,75,0.9)",
              backgroundColor: "rgba(11,14,20,0.92)",
            }}
            role="menu"
          >
            <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-white/45">
              Sort jobs
            </div>

            <div className="pb-2">
              {options.map((opt) => {
                const selected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left transition"
                    style={{
                      backgroundColor: selected
                        ? "rgba(207,174,93,0.14)"
                        : "transparent",
                    }}
                    role="menuitem"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div
                          className="text-xs font-semibold"
                          style={{
                            color: selected
                              ? "rgba(207,174,93,0.95)"
                              : "rgba(245,246,248,0.88)",
                          }}
                        >
                          {opt.label}
                        </div>
                        <div className="mt-0.5 text-[11px] text-white/45">
                          {opt.hint}
                        </div>
                      </div>

                      {selected && (
                        <span
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full border"
                          style={{
                            borderColor: "rgba(207,174,93,0.45)",
                            backgroundColor: "rgba(207,174,93,0.12)",
                            color: "rgba(207,174,93,0.95)",
                          }}
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div
              className="border-t px-3 py-2 text-[11px] text-white/45"
              style={{ borderColor: "rgba(58,63,75,0.65)" }}
            >
              Tip: use “Highest net profit” to find your best patterns fast.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
