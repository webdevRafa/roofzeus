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
      collection(db, "jobs").withConverter(jobConverter),
      where("orgId", "==", orgId),
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
      collection(db, "employees"),
      where("orgId", "==", orgId),
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

      const newRef = doc(collection(db, "jobs"));

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
    <div className="min-h-screen bg-[#0b0e14] text-white">
      {/* Subtle hero glow */}
      <div className="pointer-events-none absolute inset-x-0 -top-32 h-80 bg-[radial-gradient(ellipse_at_top,rgba(252,181,0,0.14),transparent_55%)]" />

      {/* Header */}
      <div className="relative">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-4 py-10 md:flex-row md:items-center md:justify-between md:px-0">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
              Schedule
            </p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">
              Schedule for {displayDate}
            </h1>
            <p className="mt-1 text-sm text-white/60">
              Shingles, felt, and punch jobs scheduled for this day.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/schedule")}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/75 backdrop-blur transition hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to calendar
            </button>

            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/75 backdrop-blur transition hover:bg-white/10"
            >
              <Home className="h-4 w-4" />
              Jobs overview
            </button>

            {/* NEW: generalized create button */}
            <button
              type="button"
              onClick={openCreateJobModal}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--btn-bg)] px-4 py-1.5 text-xs font-semibold text-[var(--btn-text)] shadow-[0_18px_50px_rgba(0,0,0,0.55)] transition hover:bg-[var(--btn-hover-bg)]"
            >
              <PlusCircle className="h-4 w-4" />
              New job
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative mx-auto w-[min(1100px,94vw)] space-y-6 pb-10">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_25px_70px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">
                Jobs scheduled for this day
              </h2>
              <p className="text-xs text-white/55">
                {jobsForDay.length === 0
                  ? "No jobs are currently scheduled on this date."
                  : "Review everything scheduled for this day and jump into job details."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {jobsForDay.length > 0 && (
                <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-semibold text-white/70">
                  {jobsForDay.length} job{jobsForDay.length === 1 ? "" : "s"}{" "}
                  scheduled
                </div>
              )}
            </div>
          </div>

          {jobsForDay.length === 0 ? (
            <div className="mt-6 flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/30">
                <CalendarDays className="h-6 w-6 text-white/70" />
              </div>
              <h3 className="text-sm font-semibold text-white">
                No jobs scheduled for this day
              </h3>
              <p className="max-w-sm text-xs text-white/55">
                Create a job from here. If you don’t set any schedule dates,
                we’ll default{" "}
                <span className="font-semibold text-white">Felt</span> to this
                day.
              </p>

              <button
                type="button"
                onClick={openCreateJobModal}
                className="mt-1 inline-flex items-center gap-2 rounded-full bg-[var(--btn-bg)] px-4 py-2 text-xs font-semibold text-[var(--btn-text)] transition hover:bg-[var(--btn-hover-bg)]"
              >
                <PlusCircle className="h-4 w-4" />
                Create job
              </button>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {jobsForDay.map((j) => {
                const a = addr(j.address);

                const shinglesMs = toMillis((j as any).shinglesScheduledFor);
                const feltMs = toMillis((j as any).feltScheduledFor);
                const punchMs = toMillis((j as any).punchScheduledFor);

                const shinglesOnThisDay =
                  shinglesMs != null && toYMD(new Date(shinglesMs)) === date;
                const feltOnThisDay =
                  feltMs != null && toYMD(new Date(feltMs)) === date;
                const punchOnThisDay =
                  punchMs != null && toYMD(new Date(punchMs)) === date;

                return (
                  <li
                    key={j.id}
                    className="group flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm shadow-sm transition hover:-translate-y-0.5 hover:bg-white/5"
                  >
                    <div className="flex flex-1 gap-3">
                      <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white">
                        <Home className="h-4 w-4 opacity-80" />
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">
                          {a.display || "—"}
                        </div>

                        {(a.city || a.state || a.zip) && (
                          <div className="truncate text-[11px] text-white/55">
                            {[a.city, a.state, a.zip]
                              .filter(Boolean)
                              .join(", ")}
                          </div>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/55">
                          <span
                            className={
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase " +
                              statusPillClasses(j.status)
                            }
                          >
                            {j.status}
                          </span>

                          {(shinglesOnThisDay ||
                            feltOnThisDay ||
                            punchOnThisDay) && (
                            <span className="inline-flex flex-wrap items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-0.5">
                              <span className="text-[10px] font-semibold uppercase text-white/45">
                                Scheduled:
                              </span>
                              {shinglesOnThisDay && (
                                <span className="inline-flex items-center rounded-full border border-amber-300/20 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
                                  Shingles
                                </span>
                              )}
                              {feltOnThisDay && (
                                <span className="inline-flex items-center rounded-full border border-sky-300/20 bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium text-sky-200">
                                  Felt
                                </span>
                              )}
                              {punchOnThisDay && (
                                <span className="inline-flex items-center rounded-full border border-emerald-300/20 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200">
                                  Punch
                                </span>
                              )}
                            </span>
                          )}

                          {j.updatedAt && (
                            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5">
                              Updated{" "}
                              {isFsTimestamp(j.updatedAt)
                                ? j.updatedAt.toDate().toLocaleDateString()
                                : new Date(
                                    String(j.updatedAt)
                                  ).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="text-right">
                        <div className="text-[11px] text-white/45">
                          Job total
                        </div>
                        <div className="text-sm font-semibold text-white">
                          {money(j.earnings?.totalEarningsCents)}
                        </div>
                      </div>

                      <Link
                        to={`/job/${j.id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/75 transition hover:bg-white/10"
                      >
                        View job
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* -------- Create Job Modal (copied styling/structure from DashboardJobsSection) -------- */}
      <AnimatePresence>
        {openForm && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => {
              // click outside closes
              if (e.target === e.currentTarget) resetModal();
            }}
          >
            <motion.div
              className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1f2430]/85 backdrop-blur p-5 shadow-[0_30px_90px_rgba(0,0,0,0.6)]"
              {...fadeUp(0.02)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-white">
                    Create new job
                  </h3>
                  <p className="mt-1 text-xs text-white/55">
                    Only the address is required. You can optionally schedule
                    felt, shingles, and punch.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={resetModal}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {/* Address */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/55">
                    Job address <span className="text-red-300">*</span>
                  </label>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Main St, San Antonio, TX"
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                  />
                </div>

                {/* Assign workers */}
                <div>
                  <div className="text-sm font-semibold text-white">
                    Assign workers{" "}
                    <span className="text-white/50">(optional)</span>
                  </div>

                  <div className="mt-2 max-h-40 overflow-auto rounded-xl border border-white/10 bg-black/20 p-2">
                    {employees.length === 0 ? (
                      <div className="text-sm text-white/60">
                        No active employees found.
                      </div>
                    ) : (
                      employees.map((emp) => {
                        const checked = assignedEmployeeIds.includes(emp.id);
                        return (
                          <label
                            key={emp.id}
                            className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-white/5"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-white">
                                {emp.name}
                              </div>
                              <div className="truncate text-xs text-white/50">
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
                              className="h-4 w-4 accent-[var(--color-accent)]"
                            />
                          </label>
                        );
                      })
                    )}
                  </div>

                  {assignedEmployeeIds.length > 0 && (
                    <div className="mt-2 text-xs text-white/60">
                      Assigned: {assignedEmployeeIds.length}
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

                {/* Schedule fields */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/55">
                      Schedule felt (optional)
                    </label>
                    <input
                      type="date"
                      value={newFeltDate}
                      onChange={(e) => setNewFeltDate(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs text-white/90"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/55">
                      Schedule shingles (optional)
                    </label>
                    <input
                      type="date"
                      value={newShinglesDate}
                      onChange={(e) => setNewShinglesDate(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs text-white/90"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/55">
                      Schedule punch (optional)
                    </label>
                    <input
                      type="date"
                      value={newPunchDate}
                      onChange={(e) => setNewPunchDate(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs text-white/90"
                    />
                  </div>
                </div>

                {/* Helpful hint on this page */}
                {date && (
                  <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white/60">
                    Tip: You’re creating a job from{" "}
                    <span className="font-semibold text-white/80">
                      {displayDate}
                    </span>
                    . If you leave all schedule dates blank, we’ll default{" "}
                    <span className="font-semibold text-white/80">Felt</span> to
                    this day.
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-3 text-xs text-red-300">{error}</div>
              )}

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetModal}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void createJob()}
                  disabled={creating}
                  className="rounded-xl bg-[var(--btn-bg)] px-4 py-2 text-xs font-semibold text-[var(--btn-text)] transition hover:bg-[var(--btn-hover-bg)] disabled:opacity-50"
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
