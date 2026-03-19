import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, SquarePlus } from "lucide-react";
import type { JobStatus } from "../types/types";
import { useOrgJobsData } from "../hooks/useOrgJobsData";
import { DashboardJobsSection } from "../features/dashboard/DashboardJobsSection";

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
        className="group inline-flex items-center gap-2   px-3 py-2 text-xs font-semibold outline-none transition shadow-xs hover:shadow-sm cursor-pointer"
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
    createJob,
    hasActiveDateFilter,
    rangeLabel,
  } = useOrgJobsData();

  // Local UI state for controlling UI panels and collapsible sections.
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [jobsOpen, setJobsOpen] = useState(true);

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
      <header className="sticky top-16 mt-20 md:top-18  flex items-center justify-between  bg-[var(--color-background))] backdrop-blur px-4 py-1.5 max-w-7xl mx-auto z-80">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-[var(--color-text)]">
            Jobs
          </h1>
          <span className="ml-2 text-xs sm:text-sm text-[var(--color-muted)]">
            ({totalJobs})
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* New job button */}
          <button
            type="button"
            onClick={() => setOpenForm(true)}
            className="inline-flex items-center gap-2  px-3 py-2 text-xs  font-semibold text-[var(--color-text)] shadow-xs hover:shadow-sm transition cursor-pointer"
          >
            <SquarePlus className="h-4 w-4" />
            New job
          </button>
          {/* Sort menu */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[var(--color-muted)]" />

            <SortMenu value={sortOption} onChange={(v) => setSortOption(v)} />
          </div>
        </div>
      </header>

      {/* Main content area with the job list and filters */}
      <main className="mx-auto max-w-7xl space-y-6 px-4 ">
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
