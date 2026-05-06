// src/pages/PunchDayPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type { FieldValue } from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import { db } from "../firebase/firebaseConfig";
import type { Employee, Job } from "../types/types";
import { jobConverter } from "../types/types";
import { recomputeJob, makeAddress } from "../utils/calc";
import { ArrowLeft, CalendarDays, Home, PlusCircle, X } from "lucide-react";
import { useMembership } from "../hooks/useMembership";

/** ---------- tiny motion helper (keeps file self-contained) ---------- */
const ease = [0.16, 1, 0.3, 1] as const;
function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 10 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, delay, ease },
    },
    exit: {
      opacity: 0,
      y: 10,
      transition: { duration: 0.25, ease },
    },
  };
}

/** ---------- date helpers (keep existing behavior) ---------- */
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
function isScheduledOnDate(value: unknown, ymd: string): boolean {
  const ms = toMillis(value);
  if (!ms) return false;
  return toYMD(new Date(ms)) === ymd;
}

/** ---------- display helpers (keep existing behavior) ---------- */
function addr(a: Job["address"] | null | undefined) {
  if (typeof a === "string")
    return { display: a, line1: a, city: "", state: "", zip: "" };

  const obj: Record<string, unknown> =
    (a as unknown as Record<string, unknown>) ?? {};
  const pick = (keys: string[]) => {
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === "string" && v.trim().length > 0) return v;
    }
    return "";
  };

  const line1 = pick([
    "fullLine",
    "line1",
    "street",
    "address1",
    "address",
    "formatted",
    "text",
    "label",
    "street1",
  ]);
  const city = pick(["city", "town"]);
  const state = pick(["state", "region", "province"]);
  const zip = pick(["zip", "postalCode", "postcode", "zipCode"]);
  const display =
    pick(["fullLine", "full", "formatted", "label", "text"]) || line1;

  return { display, line1, city, state, zip };
}
function money(cents: number | null | undefined): string {
  const v = typeof cents === "number" ? cents : 0;
  return (v / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

/** ---------- pills ---------- */
function statusPillClasses(status: Job["status"]) {
  switch (status) {
    case "completed":
    case "paid":
      return "bg-emerald-500/15 text-emerald-200 border border-emerald-400/20";
    case "active":
      return "bg-[var(--color-primary)]/20 text-white border border-white/10";
    case "pending":
      return "bg-amber-500/15 text-amber-200 border border-amber-400/20";
    case "invoiced":
      return "bg-sky-500/15 text-sky-200 border border-sky-400/20";
    case "closed":
    case "archived":
      return "bg-white/10 text-white/70 border border-white/10";
    default:
      return "bg-white/10 text-white/70 border border-white/10";
  }
}

export default function PunchDayPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // modal state
  const [openForm, setOpenForm] = useState(false);
  const [address, setAddress] = useState("");
  const [assignedEmployeeIds, setAssignedEmployeeIds] = useState<string[]>([]);
  const [newFeltDate, setNewFeltDate] = useState("");
  const [newShinglesDate, setNewShinglesDate] = useState("");
  const [newPunchDate, setNewPunchDate] = useState("");

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { orgId, loading: orgLoading } = useMembership();

  /** ----- Load jobs (unchanged listener intent) ----- */
  useEffect(() => {
    if (orgLoading) return;
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
    const unsub = onSnapshot(q, (snap) => {
      setJobs(snap.docs.map((d) => d.data()));
    });

    return () => unsub();
  }, [orgId, orgLoading]);

  /** ----- Load active employees for assignment list (matches JobsPage pattern) ----- */
  useEffect(() => {
    if (orgLoading) return;
    if (!orgId) {
      setEmployees([]);
      return;
    }

    const q = query(
      collection(db, "organizations", orgId, "employees"),
      where("isActive", "==", true)
    );

    const unsub = onSnapshot(q, (snap) => {
      setEmployees(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Employee, "id">),
        }))
      );
    });

    return () => unsub();
  }, [orgId, orgLoading]);

  function resetModal() {
    setOpenForm(false);
    setAddress("");
    setAssignedEmployeeIds([]);
    setNewFeltDate("");
    setNewShinglesDate("");
    setNewPunchDate("");
    setError(null);
    setCreating(false);
  }

  function openCreateJobModal() {
    setError(null);
    setOpenForm(true);

    // UX: since you clicked a specific day, prefill FELT with that day (but user can change it)
    if (date && !newFeltDate && !newShinglesDate && !newPunchDate) {
      setNewFeltDate(date);
    }
  }

  /** ----- Create job (logic aligned to JobsPage + preserves prior “defaults to felt for this day” behavior) ----- */
  async function createJob() {
    if (!orgId) {
      setError("No active organization selected.");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      if (!address.trim()) throw new Error("Please enter a job address.");

      const newRef = doc(collection(db, "organizations", orgId, "jobs"));

      // If user clears all schedule fields, default FELT to the day page we’re on (keeps your old intent)
      const shouldDefaultToThisDay =
        !!date && !newFeltDate && !newShinglesDate && !newPunchDate;

      let job: Job = {
        id: newRef.id,
        orgId,
        status: "pending",
        address: makeAddress(address),
        assignedEmployeeIds,
        earnings: { totalEarningsCents: 0, entries: [], currency: "USD" },
        expenses: {
          totalPayoutsCents: 0,
          totalMaterialsCents: 0,
          payouts: [],
          materials: [],
          currency: "USD",
        },
        summaryNotes: "",
        attachments: [],
        createdAt: serverTimestamp() as unknown as FieldValue,
        updatedAt: serverTimestamp() as unknown as FieldValue,
        computed: { totalExpensesCents: 0, netProfitCents: 0 },
      };

      if (newFeltDate)
        job.feltScheduledFor = new Date(newFeltDate + "T00:00:00");
      if (newShinglesDate)
        job.shinglesScheduledFor = new Date(newShinglesDate + "T00:00:00");
      if (newPunchDate)
        job.punchScheduledFor = new Date(newPunchDate + "T00:00:00");

      if (shouldDefaultToThisDay) {
        job.feltScheduledFor = new Date(date + "T00:00:00");
      }

      job = recomputeJob(job);
      await setDoc(newRef.withConverter(jobConverter), job);

      // Immediately jump into the job (same as your previous day-create flow)
      resetModal();
      navigate(`/job/${newRef.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  /** ----- Day filtering (unchanged behavior) ----- */
  const jobsForDay = useMemo(() => {
    if (!date) return [];
    return jobs.filter((j) => {
      const anyScheduled =
        isScheduledOnDate((j as any).shinglesScheduledFor, date) ||
        isScheduledOnDate((j as any).feltScheduledFor, date) ||
        isScheduledOnDate((j as any).punchScheduledFor, date);

      return anyScheduled;
    });
  }, [jobs, date]);

  const displayDate = date
    ? new Date(date + "T00:00:00").toLocaleDateString()
    : "Unknown date";

  const daySummary = useMemo(() => {
    if (!date) return { felt: 0, shingles: 0, punch: 0, total: 0 };

    let felt = 0;
    let shingles = 0;
    let punch = 0;

    for (const job of jobsForDay) {
      if (isScheduledOnDate((job as any).feltScheduledFor, date)) felt += 1;
      if (isScheduledOnDate((job as any).shinglesScheduledFor, date))
        shingles += 1;
      if (isScheduledOnDate((job as any).punchScheduledFor, date)) punch += 1;
    }

    return {
      felt,
      shingles,
      punch,
      total: felt + shingles + punch,
    };
  }, [jobsForDay, date]);

  if (orgLoading)
    return (
      <div className="p-6 text-sm text-white/70">Loading organization…</div>
    );

  if (!orgId)
    return (
      <div className="p-6 text-sm text-white/70">
        No organization selected. Please select an organization to view the
        schedule.
      </div>
    );

  return (
    <div className="rz-dashboard-shell min-h-screen w-full pb-10 text-[var(--color-text)]">
      <motion.div
        className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6"
        {...fadeUp(0)}
      >
        {/* Page heading */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-wide text-[var(--color-text)] sm:text-2xl">
              Schedule for {displayDate}
            </h1>
            <p className="mt-1 text-sm text-[rgb(var(--color-text-rgb)/0.58)]">
              Dry-in, shingles, and punch jobs scheduled for this day.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-1 text-[rgb(var(--color-text-rgb)/0.62)]">
              Jobs:{" "}
              <span className="font-semibold text-[rgb(var(--color-text-rgb)/0.90)]">
                {jobsForDay.length}
              </span>
            </span>

            <span className="rounded-full border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-1 text-[rgb(var(--color-text-rgb)/0.62)]">
              Scheduled items:{" "}
              <span className="font-semibold text-[rgb(var(--color-text-rgb)/0.90)]">
                {daySummary.total}
              </span>
            </span>
          </div>
        </div>

        {/* Main day shell */}
        <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm hover:shadow-md">
          {/* Header */}
          <div className="border-b border-[var(--color-border)] px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-surface-rgb)/0.55)]">
                    <CalendarDays className="h-4 w-4 text-[var(--color-accent-gold)]" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold tracking-wide text-[var(--color-text)] sm:text-xl">
                        Jobs scheduled for this day
                      </h2>

                      <span className="rounded-full border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-2.5 py-1 text-[11px] font-semibold text-[rgb(var(--color-text-rgb)/0.66)]">
                        {jobsForDay.length} job
                        {jobsForDay.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-[rgb(var(--color-text-rgb)/0.58)]">
                      {jobsForDay.length === 0
                        ? "No jobs are currently scheduled on this date."
                        : "Review the scheduled work and jump into job details."}
                    </p>
                  </div>
                </div>

                {/* Summary pills */}
                <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1 font-semibold text-sky-300">
                    <span className="h-2 w-2 rounded-full bg-sky-300" />
                    Dry-in: {daySummary.felt}
                  </span>

                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-accent-gold)]/30 bg-[var(--color-accent-gold)]/10 px-3 py-1 font-semibold text-[var(--color-accent-gold)]">
                    <span className="h-2 w-2 rounded-full bg-[var(--color-accent-gold)]" />
                    Shingles: {daySummary.shingles}
                  </span>

                  <span className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--pill-success-rgb)/0.30)] bg-[rgb(var(--pill-success-rgb)/0.12)] px-3 py-1 font-semibold text-[rgb(var(--pill-success-rgb))]">
                    <span className="h-2 w-2 rounded-full bg-[rgb(var(--pill-success-rgb))]" />
                    Punch: {daySummary.punch}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/schedule")}
                  className="inline-flex items-center gap-2 border border-[var(--color-border)] rounded-xl bg-[var(--color-card-hover)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-card)] hover:text-[rgb(var(--color-text-rgb)/0.95)]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to calendar
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/dashboard")}
                  className="inline-flex items-center gap-2 border border-[var(--color-border)] rounded-xl bg-[var(--color-card-hover)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-card)] hover:text-[rgb(var(--color-text-rgb)/0.95)]"
                >
                  <Home className="h-4 w-4" />
                  Jobs overview
                </button>

                <button
                  type="button"
                  onClick={openCreateJobModal}
                  className="inline-flex items-center gap-2 border border-[var(--color-border)] rounded-xl bg-[var(--color-card-hover)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-card)] hover:text-[rgb(var(--color-text-rgb)/0.95)]"
                >
                  <PlusCircle className="h-4 w-4" />
                  New job
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="bg-[rgb(var(--color-surface-rgb)/0.22)] p-3 sm:p-4">
            {jobsForDay.length === 0 ? (
              <div className="rounded-2xl border border-[rgb(var(--color-border-rgb)/0.14)] bg-[var(--color-card)] px-4 py-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-surface-rgb)/0.55)]">
                  <CalendarDays className="h-6 w-6 text-[var(--color-accent-gold)]" />
                </div>

                <h3 className="mt-4 text-sm font-semibold text-[var(--color-text)]">
                  No jobs scheduled for this day
                </h3>

                <p className="mx-auto mt-1 max-w-sm text-xs text-[rgb(var(--color-text-rgb)/0.58)]">
                  Create a job from here. If you leave the schedule dates blank,
                  Felt will default to this day.
                </p>

                <button
                  type="button"
                  onClick={openCreateJobModal}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-accent-gold)]/30 bg-[var(--color-accent-gold)]/10 px-4 py-2 text-xs font-semibold text-[var(--color-accent-gold)] transition hover:bg-[var(--color-accent-gold)]/15 hover:shadow-md"
                >
                  <PlusCircle className="h-4 w-4" />
                  Create job
                </button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[rgb(var(--color-border-rgb)/0.14)] bg-[var(--color-card)]">
                {/* Desktop table */}
                <div className="hidden lg:block">
                  <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
                    <colgroup>
                      <col className="w-[38%]" />
                      <col className="w-[22%]" />
                      <col className="w-[14%]" />
                      <col className="w-[16%]" />
                      <col className="w-[10%]" />
                    </colgroup>

                    <thead>
                      <tr className="border-b border-[var(--color-border)] bg-[rgb(var(--color-surface-rgb)/0.35)] text-[10px] font-bold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.58)]">
                        <th className="border-b border-[var(--color-border)] px-4 py-3 text-left">
                          Job
                        </th>
                        <th className="border-b border-[var(--color-border)] px-4 py-3 text-left">
                          Scheduled
                        </th>
                        <th className="border-b border-[var(--color-border)] px-4 py-3 text-right">
                          Profit
                        </th>
                        <th className="border-b border-[var(--color-border)] px-4 py-3 text-right">
                          Last updated
                        </th>
                        <th className="border-b border-[var(--color-border)] px-4 py-3 text-right">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {jobsForDay.map((j) => {
                        const a = addr(j.address);

                        const shinglesOnThisDay = isScheduledOnDate(
                          (j as any).shinglesScheduledFor,
                          date ?? ""
                        );
                        const feltOnThisDay = isScheduledOnDate(
                          (j as any).feltScheduledFor,
                          date ?? ""
                        );
                        const punchOnThisDay = isScheduledOnDate(
                          (j as any).punchScheduledFor,
                          date ?? ""
                        );

                        const updatedLabel = j.updatedAt
                          ? isFsTimestamp(j.updatedAt)
                            ? j.updatedAt.toDate().toLocaleDateString()
                            : new Date(String(j.updatedAt)).toLocaleDateString()
                          : "—";

                        return (
                          <tr
                            key={j.id}
                            className="group transition hover:bg-[rgb(var(--color-surface-rgb)/0.30)]"
                          >
                            <td className="border-b border-[var(--color-border)] px-4 py-4 align-middle">
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-[var(--color-text)]">
                                  {a.display || "—"}
                                </div>

                                {(a.city || a.state || a.zip) && (
                                  <div className="mt-0.5 truncate text-[11px] text-[rgb(var(--color-text-rgb)/0.55)]">
                                    {[a.city, a.state, a.zip]
                                      .filter(Boolean)
                                      .join(", ")}
                                  </div>
                                )}

                                <div className="mt-2">
                                  <span
                                    className={
                                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase " +
                                      statusPillClasses(j.status)
                                    }
                                  >
                                    {j.status}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="border-b border-[var(--color-border)] px-4 py-4 align-middle">
                              <div className="flex flex-wrap items-center gap-2">
                                {feltOnThisDay && (
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 py-1 text-[10px] font-semibold text-sky-300">
                                    <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />
                                    Dry-in
                                  </span>
                                )}

                                {shinglesOnThisDay && (
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-accent-gold)]/30 bg-[var(--color-accent-gold)]/10 px-2.5 py-1 text-[10px] font-semibold text-[var(--color-accent-gold)]">
                                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent-gold)]" />
                                    Shingles
                                  </span>
                                )}

                                {punchOnThisDay && (
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--pill-success-rgb)/0.30)] bg-[rgb(var(--pill-success-rgb)/0.12)] px-2.5 py-1 text-[10px] font-semibold text-[rgb(var(--pill-success-rgb))]">
                                    <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--pill-success-rgb))]" />
                                    Punch
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="border-b border-[var(--color-border)] px-4 py-4 text-right align-middle font-semibold text-[rgb(var(--pill-success-rgb))]">
                              {money(
                                j.computed?.netProfitCents ??
                                  j.earnings?.totalEarningsCents
                              )}
                            </td>

                            <td className="border-b border-[var(--color-border)] px-4 py-4 text-right align-middle text-xs text-[rgb(var(--color-text-rgb)/0.65)]">
                              {updatedLabel}
                            </td>

                            <td className="border-b border-[var(--color-border)] px-4 py-4 text-right align-middle">
                              <Link
                                to={`/job/${j.id}`}
                                className="inline-flex items-center justify-center rounded-xl border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-2 text-xs font-semibold text-[rgb(var(--color-text-rgb)/0.86)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.75)] hover:shadow-md"
                              >
                                View
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="grid gap-3 p-3 lg:hidden">
                  {jobsForDay.map((j) => {
                    const a = addr(j.address);

                    const shinglesOnThisDay = isScheduledOnDate(
                      (j as any).shinglesScheduledFor,
                      date ?? ""
                    );
                    const feltOnThisDay = isScheduledOnDate(
                      (j as any).feltScheduledFor,
                      date ?? ""
                    );
                    const punchOnThisDay = isScheduledOnDate(
                      (j as any).punchScheduledFor,
                      date ?? ""
                    );

                    const updatedLabel = j.updatedAt
                      ? isFsTimestamp(j.updatedAt)
                        ? j.updatedAt.toDate().toLocaleDateString()
                        : new Date(String(j.updatedAt)).toLocaleDateString()
                      : "—";

                    return (
                      <div
                        key={j.id}
                        className="rounded-2xl border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.28)] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-[var(--color-text)]">
                              {a.display || "—"}
                            </div>

                            {(a.city || a.state || a.zip) && (
                              <div className="mt-0.5 text-xs text-[rgb(var(--color-text-rgb)/0.55)]">
                                {[a.city, a.state, a.zip]
                                  .filter(Boolean)
                                  .join(", ")}
                              </div>
                            )}
                          </div>

                          <span
                            className={
                              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase " +
                              statusPillClasses(j.status)
                            }
                          >
                            {j.status}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {feltOnThisDay && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 py-1 text-[10px] font-semibold text-sky-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />
                              Dry-in
                            </span>
                          )}

                          {shinglesOnThisDay && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-accent-gold)]/30 bg-[var(--color-accent-gold)]/10 px-2.5 py-1 text-[10px] font-semibold text-[var(--color-accent-gold)]">
                              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent-gold)]" />
                              Shingles
                            </span>
                          )}

                          {punchOnThisDay && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--pill-success-rgb)/0.30)] bg-[rgb(var(--pill-success-rgb)/0.12)] px-2.5 py-1 text-[10px] font-semibold text-[rgb(var(--pill-success-rgb))]">
                              <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--pill-success-rgb))]" />
                              Punch
                            </span>
                          )}
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[rgb(var(--color-border-rgb)/0.14)] pt-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.45)]">
                              Profit
                            </div>
                            <div className="text-sm font-semibold text-[rgb(var(--pill-success-rgb))]">
                              {money(
                                j.computed?.netProfitCents ??
                                  j.earnings?.totalEarningsCents
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-[10px] uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.45)]">
                              Updated
                            </div>
                            <div className="text-xs text-[rgb(var(--color-text-rgb)/0.65)]">
                              {updatedLabel}
                            </div>
                          </div>

                          <Link
                            to={`/job/${j.id}`}
                            className="inline-flex items-center justify-center rounded-xl border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-2 text-xs font-semibold text-[rgb(var(--color-text-rgb)/0.86)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.75)]"
                          >
                            View
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="border-t border-[var(--color-border)] bg-[rgb(var(--color-surface-rgb)/0.28)] px-4 py-3 sm:px-6">
            <div className="flex flex-col gap-2 text-[11px] text-[rgb(var(--color-text-rgb)/0.55)] sm:flex-row sm:items-center sm:justify-between">
              <span>
                This page only shows jobs with dry-in, shingles, or punch
                scheduled on this date.
              </span>

              <span className="font-semibold text-[rgb(var(--color-text-rgb)/0.72)]">
                Use “New job” to create and prefill this day.
              </span>
            </div>
          </div>
        </section>
      </motion.div>

      {/* Create Job Modal */}
      <AnimatePresence>
        {openForm && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) resetModal();
            }}
          >
            <motion.div
              className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.6)]"
              {...fadeUp(0.02)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-[var(--color-text)]">
                    Create new job
                  </h3>
                  <p className="mt-1 text-xs text-[rgb(var(--color-text-rgb)/0.58)]">
                    Only the address is required. You can optionally schedule
                    dry-in, shingles, and punch.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={resetModal}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-surface-rgb)/0.55)] text-[rgb(var(--color-text-rgb)/0.72)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.75)] hover:text-[rgb(var(--color-text-rgb)/0.95)]"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3">
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

                <div>
                  <div className="text-sm font-semibold text-[var(--color-text)]">
                    Assign workers{" "}
                    <span className="text-[rgb(var(--color-text-rgb)/0.55)]">
                      (optional)
                    </span>
                  </div>

                  <div className="section-scroll mt-2 max-h-40 overflow-auto rounded-xl border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.35)] p-2">
                    {employees.length === 0 ? (
                      <div className="text-sm text-[rgb(var(--color-text-rgb)/0.60)]">
                        No active employees found.
                      </div>
                    ) : (
                      employees.map((emp) => {
                        const checked = assignedEmployeeIds.includes(emp.id);
                        return (
                          <label
                            key={emp.id}
                            className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2 transition hover:bg-[rgb(var(--color-surface-rgb)/0.55)]"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-[var(--color-text)]">
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
                    <div className="mt-2 text-xs text-[rgb(var(--color-text-rgb)/0.60)]">
                      Assigned: {assignedEmployeeIds.length}
                      <button
                        type="button"
                        onClick={() => setAssignedEmployeeIds([])}
                        className="ml-2 font-semibold text-[var(--color-accent-gold)] hover:opacity-80"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.55)]">
                      Schedule dry-in
                    </label>
                    <input
                      type="date"
                      value={newFeltDate}
                      onChange={(e) => setNewFeltDate(e.target.value)}
                      className="w-full rounded-lg border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-2 py-2 text-xs text-[rgb(var(--color-text-rgb)/0.92)] outline-none focus:ring-2 focus:ring-[var(--color-accent-gold)]/40"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.55)]">
                      Schedule shingles
                    </label>
                    <input
                      type="date"
                      value={newShinglesDate}
                      onChange={(e) => setNewShinglesDate(e.target.value)}
                      className="w-full rounded-lg border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-2 py-2 text-xs text-[rgb(var(--color-text-rgb)/0.92)] outline-none focus:ring-2 focus:ring-[var(--color-accent-gold)]/40"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.55)]">
                      Schedule punch
                    </label>
                    <input
                      type="date"
                      value={newPunchDate}
                      onChange={(e) => setNewPunchDate(e.target.value)}
                      className="w-full rounded-lg border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-2 py-2 text-xs text-[rgb(var(--color-text-rgb)/0.92)] outline-none focus:ring-2 focus:ring-[var(--color-accent-gold)]/40"
                    />
                  </div>
                </div>

                {date && (
                  <div className="rounded-xl border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.35)] px-3 py-2 text-[11px] text-[rgb(var(--color-text-rgb)/0.62)]">
                    Tip: You’re creating a job from{" "}
                    <span className="font-semibold text-[rgb(var(--color-text-rgb)/0.90)]">
                      {displayDate}
                    </span>
                    . If you leave all schedule dates blank, dry-in will default
                    to this day.
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {error}
                </div>
              )}

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetModal}
                  className="rounded-xl border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-2 text-xs font-semibold text-[rgb(var(--color-text-rgb)/0.78)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.75)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void createJob()}
                  disabled={creating}
                  className="rounded-xl border border-[var(--color-accent-gold)]/30 bg-[var(--color-accent-gold)]/10 px-4 py-2 text-xs font-semibold text-[var(--color-accent-gold)] transition hover:bg-[var(--color-accent-gold)]/15 disabled:opacity-50"
                >
                  {creating ? "Creating…" : "Create job"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
