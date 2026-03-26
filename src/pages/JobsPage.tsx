import { useState, useMemo, useRef, useEffect } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValueEvent,
  useScroll,
  type MotionProps,
} from "framer-motion";
import { SlidersHorizontal, Plus } from "lucide-react";
import type { JobStatus } from "../types/types";
import { useOrgJobsData } from "../hooks/useOrgJobsData";
import { DashboardJobsSection } from "../features/dashboard/DashboardJobsSection";
import { Search, Filter } from "lucide-react";
// A helper type for Firestore timestamps. See useOrgJobsData.ts.
type FsTimestampLike = { toDate: () => Date };

// Convert various timestamp representations to epoch milliseconds. This
// helper is used for sorting jobs by updatedAt/createdAt fields.
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

// Sort menu component for selecting the sort order of jobs. It uses a
// dropdown popover implemented with framer-motion. The menu supports three
// options: most recent, highest net profit, and lowest net profit.
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

  // Close the menu when clicking outside.
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

  // Close the menu when pressing escape.
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
        className="group inline-flex items-center gap-2   px-3 py-2   text-xs font-semibold outline-none transition shadow-xs hover:shadow-sm cursor-pointer"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="whitespace-nowrap ">{active.label}</span>

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
            className="absolute right-0 z-50 mt-2 w-[240px] overflow-hidden  bg-[var(--color-background)] shadow-sm"
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
                    className="w-full px-3 py-2 text-left transition cursor-pointer"
                    role="menuitem"
                  >
                    <div className="flex items-center justify-between gap-3 hover:shadow-md">
                      <div className="min-w-0">
                        <div
                          className="text-xs px-2 py-1 "
                          style={{
                            color: selected
                              ? "text-[var(--color-surface)]"
                              : "text-[var(--color-surface)] opacity-20",
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
                          className="inline-flex h-6 w-6 items-center justify-center "
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---- Motion helpers ----
const EASE = [0.16, 1, 0.3, 1] as const;

const fadeUp = (delay = 0): MotionProps => ({
  initial: { opacity: 0, y: 12, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.5, ease: EASE, delay },
});

// Main JobsPage component. This page consolidates the job list, search and
// filter controls, a sticky header with a new job button, and sorting logic.
export default function JobsPage() {
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
    datePreset,
    createJob,
    hasActiveDateFilter,
    rangeLabel,
  } = useOrgJobsData();

  // Local UI state for controlling UI panels and collapsible sections.
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [jobsOpen, setJobsOpen] = useState(true);

  const [mobileHeaderVisible, setMobileHeaderVisible] = useState(true);
  const { scrollY } = useScroll();
  // Track the selected sort option. Default to 'recent'.
  const [sortOption, setSortOption] = useState<"recent" | "netDesc" | "netAsc">(
    "recent"
  );

  // Build a list of unique statuses present across all jobs. This
  // dynamically drives the status filter chips in DashboardJobsSection.
  const dynamicStatusOptions: JobStatus[] = useMemo(() => {
    const set = new Set<JobStatus>();
    jobs.forEach((j) => set.add(j.status));
    return Array.from(set);
  }, [jobs]);
  const filters: Array<"all" | JobStatus> = useMemo(
    () => ["all", ...dynamicStatusOptions],
    [dynamicStatusOptions]
  );

  // Sort the filtered jobs array based on the current sort option.
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
      // default: sort by the most recent update or creation date.
      return arr.sort((a, b) => {
        const aTs = toMillis(a.updatedAt ?? a.createdAt) ?? 0;
        const bTs = toMillis(b.updatedAt ?? b.createdAt) ?? 0;
        return bTs - aTs;
      });
    }
  }, [filteredJobs, sortOption]);

  useMotionValueEvent(scrollY, "change", (latest) => {
    // only run mobile hide/show logic below xl
    if (typeof window === "undefined") return;
    if (window.innerWidth >= 1280) {
      setMobileHeaderVisible(true);
      return;
    }

    const previous = scrollY.getPrevious() ?? 0;
    const diff = latest - previous;

    // keep header visible near the top
    if (latest <= 24) {
      setMobileHeaderVisible(true);
      return;
    }

    // if search or filters are open, keep header visible
    if (showSearch || showFilters) {
      setMobileHeaderVisible(true);
      return;
    }

    // small threshold prevents jitter
    if (diff > 8) {
      setMobileHeaderVisible(false); // scrolling down
    } else if (diff < -8) {
      setMobileHeaderVisible(true); // scrolling up
    }
  });

  // Compute pagination and total net profit based on the sorted jobs.
  const jobsTotalPagesCalc = Math.max(
    1,
    Math.ceil(sortedJobs.length / JOBS_PER_PAGE)
  );
  const pagedJobsCalc = useMemo(() => {
    const start = (jobsPage - 1) * JOBS_PER_PAGE;
    return sortedJobs.slice(start, start + JOBS_PER_PAGE);
  }, [sortedJobs, jobsPage, JOBS_PER_PAGE]);

  const totalNetCalc = useMemo(
    () =>
      sortedJobs.reduce((acc, j) => acc + (j.computed?.netProfitCents ?? 0), 0),
    [sortedJobs]
  );

  const totalJobs = sortedJobs.length;

  // Show a loading or no-organization message if needed.
  const isBusy = membershipLoading;
  const hasOrg = Boolean(orgId);
  if (isBusy) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--color-muted)" }}>
        Loading organization…
      </div>
    );
  }
  if (!hasOrg) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--color-muted)" }}>
        You are not linked to an organization. Please contact your admin.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] relative">
      {/* Sticky header with page title, new job button, and sort controls */}
      <motion.header
        className="sticky top-16 md:top-18 bg-[var(--color-background)] backdrop-blur px-4 pt-4 pb-2 max-w-8xl mx-auto z-80"
        initial={false}
        animate={{
          y: mobileHeaderVisible ? 0 : -220,
          opacity: mobileHeaderVisible ? 1 : 0.98,
        }}
        transition={{ duration: 0.24, ease: EASE }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-2xl font-semibold text-[var(--color-text)] uppercase font-bebas">
              Jobs
            </h1>
            <span className="ml-1 text-xs sm:text-sm text-[var(--color-muted)]">
              {totalJobs}
            </span>
          </div>
          {/* large only date status */}
          <div className="hidden xl:flex gap-2 md:gap-6 flex-row items-end h-full ">
            {/* Search toggle */}
            <div className="relative ">
              <button
                type="button"
                onClick={() => setShowSearch((v) => !v)}
                className={`cursor-pointer hover:shadow-md inline-flex items-center justify-center rounded-xl   text-xs md:text-md font-semibold   transition  ${
                  showSearch === true
                    ? "text-[rgb(var(--pill-success-rgb))]"
                    : "text-[var(--color-text)]"
                }`}
                title="Search addresses"
                aria-label="Search addresses"
              >
                <Search size={16} className="mr-2" />
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
                      className="w-full  border border-[rgb(var(--color-border-rgb)/0.05)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-2 text-sm text-[rgb(var(--color-text-rgb)/0.92)] outline-none ring-1 ring-[var(--color-text)]/70"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* Date filter toggle */}
            <div className="">
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className={`cursor-pointer hover:shadow-md inline-flex  items-center justify-center   text-xs md:text-md font-semibold text-[rgb(var(--color-text-rgb)/0.78)] transition ${
                  showFilters
                    ? "text-[rgb(var(--pill-success-rgb))]"
                    : "text-[var(--color-text)]"
                }`}
                title="Filter by last updated date"
              >
                <Filter size={16} className="mr-2" />
                <span>
                  {hasActiveDateFilter ? "Edit date range" : "Date filters"}
                </span>
              </button>
            </div>
            {/* show what dates are being filtered, and status */}
            <div className="flex flex-row justify-start gap-1 text-xs md:text-md  mb-3 md:mb-0">
              {hasActiveDateFilter ? (
                <span className="inline-flex items-center    text-[var(--color-text-rgb)] bg-[var(--color-card)] border-1 border-[var(--color-blue)]/40 px-3">
                  Dates: {rangeLabel || "Custom range"}
                </span>
              ) : (
                <span className="inline-flex items-center    text-[var(--color-text-rgb)]">
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
          <div className="flex items-center gap-3">
            {/* New job button */}
            <button
              type="button"
              onClick={() => setOpenForm(true)}
              className="inline-flex items-center gap-2  px-3 py-2 text-xs    text-[var(--color-text)] shadow-xs hover:shadow-sm transition cursor-pointer "
            >
              <Plus className="h-4 w-4" />
              New job
            </button>
            {/* Sort menu */}
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-[var(--color-muted)]" />

              <SortMenu value={sortOption} onChange={(v) => setSortOption(v)} />
            </div>
          </div>
        </div>

        {/* MOBILE ONLY: controls + floating search */}
        <div className="xl:hidden relative my-2">
          {/* top row */}
          <div className="flex items-center gap-5 md:gap-6">
            {/* Search toggle */}
            <button
              type="button"
              onClick={() => {
                setShowSearch((v) => !v);
                setShowFilters(false);
              }}
              className={`cursor-pointer hover:shadow-md inline-flex items-center justify-center rounded-xl text-sm md:text-md font-semibold transition ${
                showSearch
                  ? "text-[var(--color-text)]"
                  : "text-[var(--color-text)]/60"
              }`}
              title="Search addresses"
              aria-label="Search addresses"
              aria-expanded={showSearch}
            >
              <Search size={16} className="mr-2" />
              <span>Search</span>
            </button>

            {/* Date filter toggle */}
            <button
              type="button"
              onClick={() => {
                setShowFilters((v) => !v);
                setShowSearch(false);
              }}
              className={`cursor-pointer hover:shadow-md inline-flex items-center justify-center text-sm md:text-md font-semibold transition ${
                showFilters
                  ? "text-[var(--color-text)]"
                  : "text-[var(--color-text)]/60"
              }`}
              title="Filter by last updated date"
            >
              <Filter size={16} className="mr-2" />
              <span>{hasActiveDateFilter ? "Edit dates" : "Date filters"}</span>
            </button>
          </div>

          {/* floating mobile search panel */}
          <AnimatePresence initial={false}>
            {showSearch && (
              <motion.div
                {...fadeUp(0.02)}
                className="absolute left-0 right-0 top-[calc(100%+10px)] z-[90]"
              >
                <div className="ring-1 ring-white/70 bg-[var(--color-background)] backdrop-blur-xl  ">
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by address..."
                    autoFocus
                    className="w-full ring-1 ring-white/40 focus:ring-white  border border-[rgb(var(--color-border-rgb)/0.08)] bg-[rgb(var(--color-surface-rgb)/0.6)] px-3 py-2.5 text-sm text-[var(--color-text)]/70"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* status row stays in normal layout */}
          <div className="mt-3 flex flex-row justify-start gap-4 text-sm md:text-md">
            {hasActiveDateFilter ? (
              <span className="inline-flex items-center text-[var(--color-text-rgb)] bg-[var(--color-card)] border border-[var(--color-blue)]/40 px-3">
                Dates: {rangeLabel || "Custom range"}
              </span>
            ) : (
              <span className="inline-flex items-center text-[var(--color-text-rgb)]">
                Date: All time
              </span>
            )}

            <span className="inline-flex items-center text-[var(--color-text-rgb)]">
              Status:{" "}
              <span className="ml-1 font-semibold text-[var(--color-text-rgb)]">
                {statusFilter === "all" ? "All" : statusFilter}
              </span>
            </span>
          </div>
        </div>
        {/* Date range filters */}
        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.section
              id="date-filters"
              className="bg-[var(--color-background)]  px-4 sm:px-6 py-4 relative z-40"
              {...fadeUp(0.06)}
            >
              <div className="flex flex-col  lg:flex-row lg:items-end lg:justify-between">
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
                        className="border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-2 py-2 text-xs text-[rgb(var(--color-text-rgb)/0.92)]"
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
                        className="border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-2 py-2 text-xs text-[rgb(var(--color-text-rgb)/0.92)]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => applyPreset("last7")}
                      className={` px-3 py-2 text-xs font-semibold transition hover:text-[var(--color-text)] cursor-pointer ${
                        datePreset === "last7"
                          ? " shadow-sm bg-[var(--color-card-hover)] text-[var(--color-text)]"
                          : " bg-[rgb(var(--color-surface-rgb)/0.55)] text-[rgb(var(--color-text-rgb)/0.72)] hover:bg-[rgb(var(--color-surface-rgb)/0.75)]"
                      }`}
                    >
                      Last 7 days
                    </button>

                    <button
                      type="button"
                      onClick={() => applyPreset("thisMonth")}
                      className={` px-3 py-2 text-xs font-semibold transition hover:text-[var(--color-text)] cursor-pointer ${
                        datePreset === "thisMonth"
                          ? " bg-[var(--color-card-hover)] text-[var(--color-text)]"
                          : " bg-[rgb(var(--color-surface-rgb)/0.55)] text-[rgb(var(--color-text-rgb)/0.72)] hover:bg-[rgb(var(--color-surface-rgb)/0.75)]"
                      }`}
                    >
                      This month
                    </button>

                    <button
                      type="button"
                      onClick={() => applyPreset("ytd")}
                      className={`  px-3 py-2 text-xs font-semibold transition hover:text-[var(--color-text)] cursor-pointer ${
                        datePreset === "ytd"
                          ? " bg-[var(--color-card)] text-[var(--color-text)]"
                          : " bg-[rgb(var(--color-surface-rgb)/0.55)] text-[rgb(var(--color-text-rgb)/0.72)] hover:bg-[rgb(var(--color-surface-rgb)/0.75)]"
                      }`}
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
                      className=" border border-red-300/20 bg-red-300/10 hover:bg-red-300/15 px-3 py-2 text-xs font-semibold text-red-200 transition cursor-pointer hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Main content area with the job list and filters */}
      <main className="mx-auto max-w-8xl space-y-6 px-4 ">
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
          datePreset={datePreset}
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
          pagedJobs={pagedJobsCalc}
          jobsPage={jobsPage}
          jobsTotalPages={jobsTotalPagesCalc}
          setJobsPage={setJobsPage}
          JOBS_PER_PAGE={JOBS_PER_PAGE}
          totalNet={totalNetCalc}
        />
      </main>
    </div>
  );
}
