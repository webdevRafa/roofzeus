import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
  where,
} from "firebase/firestore";
import type { FieldValue } from "firebase/firestore";

import { db } from "../firebase/firebaseConfig";
import { useOrg } from "../contexts/OrgContext";
import type { Employee, Job, JobStatus } from "../types/types";
import { jobConverter } from "../types/types";
import { recomputeJob } from "../utils/calc";

export type DatePreset = "custom" | "last7" | "thisMonth" | "ytd";
export type StatusFilter = "all" | JobStatus;

function isFsTimestamp(val: unknown): val is { toDate: () => Date } {
  return typeof (val as { toDate?: () => Date })?.toDate === "function";
}

function toMillis(x: unknown): number | null {
  if (x == null) return null;
  let dt: Date | null = null;

  if (isFsTimestamp(x)) dt = x.toDate();
  else if (x instanceof Date) dt = x;
  else if (typeof x === "string" || typeof x === "number") {
    const candidate = new Date(x);
    if (!Number.isNaN(candidate.getTime())) dt = candidate;
  }

  return dt ? dt.getTime() : null;
}

function toYMD(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatYmdForChip(ymd: string | ""): string {
  if (!ymd) return "…";

  const [yearStr, monthStr, dayStr] = ymd.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const day = Number(dayStr);

  const date = new Date(year, monthIndex, day);
  if (Number.isNaN(date.getTime())) return "…";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return "";
}

function addr(a: Job["address"] | null | undefined) {
  if (typeof a === "string") {
    return { display: a, line1: a, city: "", state: "", zip: "" };
  }

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

export function useOrgJobsData() {
  const { orgId, loading: membershipLoading } = useOrg();
  const navigate = useNavigate();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [datePreset, setDatePreset] = useState<DatePreset>("custom");
  const [searchTerm, setSearchTerm] = useState("");

  const [jobsPage, setJobsPage] = useState(1);
  const JOBS_PER_PAGE = 20;

  const [openForm, setOpenForm] = useState(false);
  const [orgDefaultState, setOrgDefaultState] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [newFeltDate, setNewFeltDate] = useState("");
  const [newShinglesDate, setNewShinglesDate] = useState("");
  const [newPunchDate, setNewPunchDate] = useState("");
  const [assignedEmployeeIds, setAssignedEmployeeIds] = useState<string[]>([]);

  useEffect(() => {
    if (!orgId) return;

    const q = query(
      collection(db, "organizations", orgId, "jobs").withConverter(jobConverter),
      orderBy("updatedAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setJobs(snap.docs.map((d) => d.data()));
    });

    return () => unsub();
  }, [orgId]);

  useEffect(() => {
    if (!orgId) {
      setOrgDefaultState("");
      return;
    }

    const orgRef = doc(db, "organizations", orgId);

    const unsub = onSnapshot(orgRef, (snap) => {
      const data = snap.data() as { defaultState?: string | null } | undefined;
      const nextDefaultState = (data?.defaultState ?? "").trim().toUpperCase();

      setOrgDefaultState(nextDefaultState);

      // Only auto-fill if the form state is still empty.
      setState((current) => (current.trim() ? current : nextDefaultState));
    });

    return () => unsub();
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;

    const employeesQuery = query(
      collection(db, "organizations", orgId, "employees"),
      where("isActive", "==", true)
    );

    const unsub = onSnapshot(employeesQuery, (snap) => {
      setEmployees(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Employee, "id">),
        }))
      );
    });

    return () => unsub();
  }, [orgId]);

  function recomputeDates(p: DatePreset, now = new Date()) {
    if (p === "last7") {
      const end = now;
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      setStartDate(toYMD(start));
      setEndDate(toYMD(end));
    } else if (p === "thisMonth") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(toYMD(start));
      setEndDate(toYMD(end));
    } else if (p === "ytd") {
      const start = new Date(now.getFullYear(), 0, 1);
      setStartDate(toYMD(start));
      setEndDate(toYMD(now));
    }
  }

  function applyPreset(p: DatePreset) {
    setDatePreset(p);
    if (p !== "custom") recomputeDates(p);
  }

  function msUntilNextMidnight() {
    const now = new Date();
    const next = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      0,
      50
    );
    return next.getTime() - now.getTime();
  }

  useEffect(() => {
    if (datePreset === "custom") return;

    recomputeDates(datePreset);

    let timer = setTimeout(function tick() {
      recomputeDates(datePreset);
      timer = setTimeout(tick, msUntilNextMidnight());
    }, msUntilNextMidnight());

    return () => clearTimeout(timer);
  }, [datePreset]);

  const filteredJobs = useMemo(() => {
    const hasStart = Boolean(startDate);
    const hasEnd = Boolean(endDate);
    const startMs = hasStart
      ? new Date(startDate + "T00:00:00").getTime()
      : null;
    const endMs = hasEnd ? new Date(endDate + "T23:59:59.999").getTime() : null;
    const term = searchTerm.trim().toLowerCase();

    return jobs.filter((j) => {
      if (statusFilter !== "all" && j.status !== statusFilter) return false;

      const reference = j.updatedAt ?? j.createdAt ?? null;
      const ts = toMillis(reference);
      if (ts == null) return false;

      if (startMs != null && ts < startMs) return false;
      if (endMs != null && ts > endMs) return false;

      if (term.length > 0) {
        const a = addr(j.address);
        const haystack = [a.display, a.line1, a.city, a.state, a.zip]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(term)) return false;
      }

      return true;
    });
  }, [jobs, statusFilter, startDate, endDate, searchTerm]);

  const materialProgressJobs = useMemo(() => {
    const toMs = (v: unknown): number | null => toMillis(v ?? null);

    const firstSchedule = (job: Job): number => {
      const feltSch = toMs((job as any).feltScheduledFor ?? null);
      const shSch = toMs((job as any).shinglesScheduledFor ?? null);
      const candidates = [feltSch, shSch].filter((v): v is number => v != null);
      if (candidates.length === 0) return Number.POSITIVE_INFINITY;
      return Math.min(...candidates);
    };

    return jobs
      .filter((j) => {
        if (
          j.status === "completed" ||
          j.status === "closed" ||
          j.status === "archived"
        ) {
          return false;
        }

        const feltSch = toMs((j as any).feltScheduledFor ?? null);
        const shSch = toMs((j as any).shinglesScheduledFor ?? null);
        const feltDone = toMs((j as any).feltCompletedAt ?? null);
        const shDone = toMs((j as any).shinglesCompletedAt ?? null);

        if (feltDone != null && shDone != null) return false;

        return (
          feltSch != null || shSch != null || feltDone != null || shDone != null
        );
      })
      .sort((a, b) => firstSchedule(a) - firstSchedule(b));
  }, [jobs]);

  const readyForPunchJobs = useMemo(() => {
    const toMs = (v: unknown): number | null => toMillis(v ?? null);

    return jobs
      .filter((j) => {
        if (
          j.status === "completed" ||
          j.status === "closed" ||
          j.status === "archived"
        ) {
          return false;
        }

        if ((j as any).punchedAt) return false;

        const feltDone = toMs((j as any).feltCompletedAt ?? null);
        const shDone = toMs((j as any).shinglesCompletedAt ?? null);

        return feltDone != null && shDone != null;
      })
      .sort((a, b) => {
        const feltA =
          toMs((a as any).feltCompletedAt ?? null) ?? Number.MAX_VALUE;
        const shA =
          toMs((a as any).shinglesCompletedAt ?? null) ?? Number.MAX_VALUE;
        const feltB =
          toMs((b as any).feltCompletedAt ?? null) ?? Number.MAX_VALUE;
        const shB =
          toMs((b as any).shinglesCompletedAt ?? null) ?? Number.MAX_VALUE;

        return Math.max(feltA, shA) - Math.max(feltB, shB);
      });
  }, [jobs]);

  useEffect(() => {
    setJobsPage(1);
  }, [statusFilter, startDate, endDate, datePreset, searchTerm, jobs.length]);
  useEffect(() => {
    if (!openForm) return;

    setState((current) => (current.trim() ? current : orgDefaultState));
  }, [openForm, orgDefaultState]);
  const totalNet = useMemo(
    () =>
      filteredJobs.reduce(
        (acc, j) => acc + (j.computed?.netProfitCents ?? 0),
        0
      ),
    [filteredJobs]
  );

  const jobsTotalPages = Math.max(
    1,
    Math.ceil(filteredJobs.length / JOBS_PER_PAGE)
  );

  const pagedJobs = useMemo(() => {
    const start = (jobsPage - 1) * JOBS_PER_PAGE;
    const end = start + JOBS_PER_PAGE;
    return filteredJobs.slice(start, end);
  }, [filteredJobs, jobsPage]);

  async function createJob() {
    setLoading(true);
    setError(null);

    try {
      if (!address.trim()) {
        throw new Error("Please enter a job address.");
      }

      if (!orgId) throw new Error("Missing orgId.");

      const newRef = doc(collection(db, "organizations", orgId, "jobs"));

      const trimmedAddress = address.trim();
      const trimmedCity = city.trim();
      const trimmedState = state.trim();
      const trimmedZip = zip.trim();

      const fullLineParts = [
        trimmedAddress,
        [trimmedCity, trimmedState].filter(Boolean).join(", "),
        trimmedZip,
      ].filter(Boolean);

      const jobAddress: Job["address"] = {
        fullLine: fullLineParts.join(", "),
        line1: trimmedAddress,
        ...(trimmedCity ? { city: trimmedCity } : {}),
        ...(trimmedState ? { state: trimmedState } : {}),
        ...(trimmedZip
          ? {
              zip: trimmedZip,
              postalCode: trimmedZip,
            }
          : {}),
      };

      let job: Job = {
        id: newRef.id,
        orgId,
        status: "pending",
        address: jobAddress,
        assignedEmployeeIds,
        earnings: {
          totalEarningsCents: 0,
          entries: [],
          currency: "USD",
        },
        expenses: {
          totalPayoutsCents: 0,
          totalMaterialsCents: 0,
          payouts: [],
          materials: [],
          currency: "USD",
        },
        summaryNotes: "",
        attachments: [],
        createdAt: serverTimestamp() as FieldValue,
        updatedAt: serverTimestamp() as FieldValue,
        computed: {
          totalExpensesCents: 0,
          netProfitCents: 0,
        },
      };

      if (newFeltDate) {
        job.feltScheduledFor = new Date(newFeltDate + "T00:00:00");
      }
      if (newShinglesDate) {
        job.shinglesScheduledFor = new Date(newShinglesDate + "T00:00:00");
      }
      if (newPunchDate) {
        job.punchScheduledFor = new Date(newPunchDate + "T00:00:00");
      }

      job = recomputeJob(job);

      await setDoc(newRef.withConverter(jobConverter), job);

      const createdJobId = newRef.id;

      setAddress("");
      setCity("");
      setState(orgDefaultState);
      setZip("");
      setAssignedEmployeeIds([]);
      setOpenForm(false);
      setNewFeltDate("");
      setNewShinglesDate("");
      setNewPunchDate("");

      navigate(`/job/${createdJobId}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function savePunchReschedule(jobId: string, rescheduleDate: string) {
    if (!orgId) throw new Error("Missing orgId.");
    if (!rescheduleDate) return;

    const ref = doc(
      collection(db, "organizations", orgId, "jobs"),
      jobId
    ).withConverter(jobConverter);

    await setDoc(
      ref,
      {
        punchScheduledFor: new Date(rescheduleDate + "T00:00:00"),
        updatedAt: serverTimestamp() as FieldValue,
      },
      { merge: true }
    );
  }

  const filters: StatusFilter[] = ["all", "pending", "completed"];

  const hasActiveDateFilter =
    datePreset !== "custom" || Boolean(startDate || endDate);

  const presetLabel =
    datePreset === "last7"
      ? "Last 7 days"
      : datePreset === "thisMonth"
      ? "This month"
      : datePreset === "ytd"
      ? "Year to date"
      : null;

  const rangeLabel =
    presetLabel ??
    (startDate || endDate
      ? `${formatYmdForChip(startDate)} → ${formatYmdForChip(endDate)}`
      : null);

  return {
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
    datePreset,
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
    city,
    setCity,
    state,
    setState,
    zip,
    setZip,
    newFeltDate,
    setNewFeltDate,
    newShinglesDate,
    setNewShinglesDate,
    newPunchDate,
    setNewPunchDate,
    assignedEmployeeIds,
    setAssignedEmployeeIds,
    filteredJobs,
    pagedJobs,
    totalNet,
    jobsTotalPages,
    materialProgressJobs,
    readyForPunchJobs,
    applyPreset,
    createJob,
    savePunchReschedule,
    filters,
    hasActiveDateFilter,
    rangeLabel,
  };
}