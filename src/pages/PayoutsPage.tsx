// src/pages/PayoutsPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type FieldValue,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { useOrg } from "../contexts/OrgContext";
import type {
  Employee,
  PayoutDoc,
  PayoutStubDoc,
  PayoutStubLine,
} from "../types/types";

import {
  AnimatePresence,
  motion,
  type MotionProps,
  type Variants,
} from "framer-motion";
import CountUp from "react-countup";
import {
  Search,
  Filter,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronRight,
  FileText,
  Wallet,
  BadgeDollarSign,
  Users,
} from "lucide-react";

// If you already have these components (you do in EmployeeDetailPage.tsx), keep the paths identical
import { GlobalPayoutStubModal } from "../components/GlobalPayoutStubModal";
import { PayoutStubViewerModal } from "../components/PayoutStubViewerModal";
import PayTechnicianModal from "../components/PayTechnicianModal";

// ---------------- motion helpers ----------------
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const fadeUpItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
};

const fadeUp = (delay = 0): Partial<MotionProps> => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: EASE, delay },
});

// ---------------- small utils ----------------
type FsTimestampLike = { toDate: () => Date };
function isFsTimestamp(x: unknown): x is FsTimestampLike {
  return typeof (x as FsTimestampLike)?.toDate === "function";
}
function toMillis(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (v instanceof Date) return v.getTime();
  if (isFsTimestamp(v)) return v.toDate().getTime();
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  return null;
}
function fmtDateTime(v: unknown): string {
  const ms = toMillis(v);
  if (ms == null) return "—";
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function fmtDate(v: unknown): string {
  const ms = toMillis(v);
  if (ms == null) return "—";
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function money(cents?: number | null): string {
  const v = typeof cents === "number" ? cents : 0;
  return (v / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function safeLower(x: unknown) {
  return typeof x === "string" ? x.toLowerCase() : "";
}
function getEmployeeDisplayName(p: PayoutDoc) {
  return (
    (p as any).employeeNameSnapshot || (p as any).payeeNickname || "Unknown"
  );
}
function getJobAddress(p: PayoutDoc) {
  const a: any = (p as any).jobAddressSnapshot;
  if (!a) return "";
  if (typeof a === "string") return a;
  if (typeof a === "object")
    return a.display || a.fullLine || a.line1 || a.address || "";
  return "";
}
function getCategory(p: PayoutDoc) {
  return ((p as any).category as string) || "unknown";
}
function getMethod(p: PayoutDoc) {
  return ((p as any).method as string) || "check";
}
function isPaid(p: PayoutDoc) {
  return Boolean((p as any).paidAt);
}
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function withinRange(
  ms: number | null,
  startMs: number | null,
  endMs: number | null
) {
  if (ms == null) return false;
  if (startMs != null && ms < startMs) return false;
  if (endMs != null && ms > endMs) return false;
  return true;
}
function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------------- types ----------------
type PayoutTab = "pending" | "paid" | "all";
type MobileView = "payouts" | "stubs";

export default function PayoutsPage() {
  const { orgId, loading: orgLoading } = useOrg();

  // data
  const [payouts, setPayouts] = useState<PayoutDoc[]>([]);
  const [stubs, setStubs] = useState<PayoutStubDoc[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // loading/errors
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [tab, setTab] = useState<PayoutTab>("pending");
  const [mobileView, setMobileView] = useState<MobileView>("payouts");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [method, setMethod] = useState<string>("all");
  const [employeeId, setEmployeeId] = useState<string>("all");

  const [dateStart, setDateStart] = useState<string>(""); // yyyy-mm-dd
  const [dateEnd, setDateEnd] = useState<string>(""); // yyyy-mm-dd

  // selection + actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [stubOpen, setStubOpen] = useState(false);
  const [stubEmployee, setStubEmployee] = useState<Employee | null>(null);
  const [stubSaving, setStubSaving] = useState(false);

  // modals
  const [viewStubId, setViewStubId] = useState<string | null>(null);

  const viewStubStub = useMemo(() => {
    if (!viewStubId) return null;
    return stubs.find((s) => s.id === viewStubId) ?? null;
  }, [stubs, viewStubId]);

  const viewEmployee = useMemo(() => {
    if (!viewStubStub?.employeeId) return null;
    return employees.find((e) => e.id === viewStubStub.employeeId) ?? null;
  }, [employees, viewStubStub]);

  const [dayRateOpen, setDayRateOpen] = useState(false);

  // pagination
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const listTopRef = useRef<HTMLDivElement | null>(null);

  // ---------- subscriptions ----------
  useEffect(() => {
    if (orgLoading) return;
    if (!orgId) {
      setPayouts([]);
      setStubs([]);
      setEmployees([]);
      return;
    }

    setError(null);

    // payouts
    const payoutQ = query(
      collection(db, "payouts"),
      where("orgId", "==", orgId),
      orderBy("createdAt", "desc")
    );

    // stubs
    const stubsQ = query(
      collection(db, "payoutStubs"),
      where("orgId", "==", orgId),
      orderBy("paidAt", "desc")
    );

    // employees (for filter dropdown + stub address snapshots)
    const empQ = query(
      collection(db, "employees"),
      where("orgId", "==", orgId),
      orderBy("name", "asc")
    );

    const unsubP = onSnapshot(
      payoutQ,
      (snap) =>
        setPayouts(
          snap.docs.map(
            (d) => ({ id: d.id, ...(d.data() as any) } as PayoutDoc)
          )
        ),
      (e) => setError(e.message)
    );

    const unsubS = onSnapshot(
      stubsQ,
      (snap) =>
        setStubs(
          snap.docs.map(
            (d) => ({ id: d.id, ...(d.data() as any) } as PayoutStubDoc)
          )
        ),
      (e) => setError(e.message)
    );

    const unsubE = onSnapshot(
      empQ,
      (snap) =>
        setEmployees(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Employee))
        ),
      (e) => setError(e.message)
    );

    return () => {
      unsubP();
      unsubS();
      unsubE();
    };
  }, [orgId, orgLoading]);

  // close on ESC for viewer modal
  useEffect(() => {
    if (!viewStubId && !stubOpen && !dayRateOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setViewStubId(null);
        setStubOpen(false);
        setDayRateOpen(false);
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [viewStubId, stubOpen, dayRateOpen]);

  // ---------- selection logic ----------
  const selectedPayouts = useMemo(
    () => payouts.filter((p) => selectedIds.includes(p.id)),
    [payouts, selectedIds]
  );

  const selectedEmployeeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of selectedPayouts) {
      const eid = (p as any).employeeId as string | undefined;
      if (eid) ids.add(eid);
    }
    return Array.from(ids);
  }, [selectedPayouts]);

  const canCreateStub =
    selectedIds.length > 0 && selectedEmployeeIds.length === 1;

  useEffect(() => {
    if (!stubOpen) {
      setStubEmployee(null);
      return;
    }
    if (selectedEmployeeIds.length !== 1) {
      setStubEmployee(null);
      return;
    }

    const eid = selectedEmployeeIds[0];
    // try local first
    const local = employees.find((e) => e.id === eid);
    if (local) {
      setStubEmployee(local);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(collection(db, "employees"), eid));
        if (!snap.exists()) return;
        if (!cancelled)
          setStubEmployee({ id: snap.id, ...(snap.data() as any) } as Employee);
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stubOpen, selectedEmployeeIds, employees]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }
  function clearSelected() {
    setSelectedIds([]);
  }

  // ---------- filters ----------
  const startMs = useMemo(
    () => (dateStart ? new Date(dateStart + "T00:00:00").getTime() : null),
    [dateStart]
  );
  const endMs = useMemo(
    () => (dateEnd ? new Date(dateEnd + "T23:59:59").getTime() : null),
    [dateEnd]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const bySearch = (p: PayoutDoc) => {
      if (!q) return true;
      const name = safeLower(getEmployeeDisplayName(p));
      const addr = safeLower(getJobAddress(p));
      return name.includes(q) || addr.includes(q);
    };

    return payouts.filter((p) => {
      if (tab === "pending" && isPaid(p)) return false;
      if (tab === "paid" && !isPaid(p)) return false;

      if (employeeId !== "all" && (p as any).employeeId !== employeeId)
        return false;

      if (category !== "all" && getCategory(p) !== category) return false;
      if (method !== "all" && getMethod(p) !== method) return false;

      if (startMs != null || endMs != null) {
        const createdMs = toMillis((p as any).createdAt);
        if (!withinRange(createdMs, startMs, endMs)) return false;
      }

      return bySearch(p);
    });
  }, [payouts, tab, employeeId, category, method, search, startMs, endMs]);

  // reset pagination on filter changes
  useEffect(() => {
    setPage(1);
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, employeeId, category, method, search, dateStart, dateEnd]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(filtered.length / PER_PAGE)),
    [filtered.length]
  );
  const pageSafe = clamp(page, 1, pageCount);

  const paged = useMemo(() => {
    const start = (pageSafe - 1) * PER_PAGE;
    return filtered.slice(start, start + PER_PAGE);
  }, [filtered, pageSafe]);

  // ---------- KPI rollups ----------
  const kpis = useMemo(() => {
    const pending = payouts.filter((p) => !isPaid(p));
    const paid = payouts.filter((p) => isPaid(p));

    const pendingTotal = pending.reduce(
      (s, p) => s + (Number((p as any).amountCents) || 0),
      0
    );
    const paidTotal = paid.reduce(
      (s, p) => s + (Number((p as any).amountCents) || 0),
      0
    );

    const avg = (arr: PayoutDoc[]) => {
      if (arr.length === 0) return 0;
      const sum = arr.reduce(
        (s, p) => s + (Number((p as any).amountCents) || 0),
        0
      );
      return Math.round(sum / arr.length);
    };

    return {
      pendingCount: pending.length,
      paidCount: paid.length,
      pendingTotal,
      paidTotal,
      avgPayoutCents: avg(payouts),
      avgPendingCents: avg(pending),
    };
  }, [payouts]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of payouts) set.add(getCategory(p));
    return Array.from(set).sort();
  }, [payouts]);

  const methods = useMemo(() => {
    const set = new Set<string>();
    for (const p of payouts) set.add(getMethod(p));
    return Array.from(set).sort();
  }, [payouts]);

  // ---------- actions ----------
  async function markSelectedAsPaidAndCreateStub() {
    if (selectedIds.length === 0) return;

    const toMark = selectedPayouts.filter((p) => !isPaid(p));
    if (toMark.length === 0) {
      setStubOpen(false);
      return;
    }

    setStubSaving(true);
    try {
      if (!orgId) throw new Error("Missing orgId (cannot create payout stub).");
      if (!stubEmployee)
        throw new Error("Missing employee (cannot create stub).");
      if (!stubEmployee.id) throw new Error("Employee is missing id.");

      const stubRef = doc(collection(db, "payoutStubs"));
      const now = new Date();
      const y = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const shortId = stubRef.id.slice(0, 6).toUpperCase();
      const number = `STUB-${y}${mm}${dd}-${shortId}`;

      // Build lines WITHOUT undefined fields
      const lines: PayoutStubLine[] = toMark.map((p) => ({
        payoutId: p.id,
        category: (p as any).category,
        ...(typeof (p as any).sqft === "number"
          ? { sqft: (p as any).sqft }
          : {}),
        ...(typeof (p as any).ratePerSqFt === "number"
          ? { ratePerSqFt: (p as any).ratePerSqFt }
          : {}),
        amountCents:
          typeof (p as any).amountCents === "number"
            ? (p as any).amountCents
            : 0,
        ...((p as any).jobId ? { jobId: (p as any).jobId } : {}),
        ...((p as any).jobAddressSnapshot
          ? { jobAddressSnapshot: (p as any).jobAddressSnapshot }
          : {}),
      })) as any;

      const totalCents = lines.reduce(
        (sum, l) => sum + (l.amountCents || 0),
        0
      );
      const jobIds = Array.from(
        new Set(lines.map((l: any) => l.jobId).filter(Boolean))
      ) as string[];

      // Address snapshot (omit if empty)
      const employeeAddr = (stubEmployee as any).address
        ? typeof (stubEmployee as any).address === "string"
          ? {
              fullLine: (stubEmployee as any).address,
              line1: (stubEmployee as any).address,
            }
          : (stubEmployee as any).address
        : null;

      const stubDoc: any = {
        id: stubRef.id,
        number,
        employeeId: stubEmployee.id,
        orgId,
        employeeNameSnapshot: (stubEmployee as any).name,
        ...(employeeAddr ? { employeeAddressSnapshot: employeeAddr } : {}),
        payoutIds: lines.map((l: any) => l.payoutId),
        jobIds,
        lines,
        totalCents,
        createdAt: serverTimestamp() as unknown as FieldValue,
        paidAt: serverTimestamp() as unknown as FieldValue,
        status: "paid",
      };

      await setDoc(stubRef, stubDoc);

      await Promise.all(
        toMark.map((p) =>
          setDoc(
            doc(collection(db, "payouts"), p.id),
            { paidAt: serverTimestamp(), payoutStubId: stubRef.id },
            { merge: true }
          )
        )
      );

      setSelectedIds([]);
      setStubOpen(false);
      setViewStubId(stubRef.id); // quick open stub viewer
    } catch (e) {
      console.error(e);
      alert("Failed to mark payouts as paid + create stub. See console.");
    } finally {
      setStubSaving(false);
    }
  }

  function exportCsv() {
    const rows = filtered.map((p) => {
      const created = fmtDateTime((p as any).createdAt);
      const paid = (p as any).paidAt ? fmtDateTime((p as any).paidAt) : "";
      return {
        id: p.id,
        employee: getEmployeeDisplayName(p),
        address: getJobAddress(p),
        category: getCategory(p),
        method: getMethod(p),
        amount: ((Number((p as any).amountCents) || 0) / 100).toFixed(2),
        status: isPaid(p) ? "paid" : "pending",
        createdAt: created,
        paidAt: paid,
        payoutStubId: (p as any).payoutStubId || "",
      };
    });

    const header = Object.keys(rows[0] || {}).join(",");
    const body = rows
      .map((r) =>
        Object.values(r)
          .map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    const filename = `payouts_${ymd(new Date())}.csv`;
    downloadText(filename, header + "\n" + body);
  }

  // ---------- UI ----------
  const pillBase =
    "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-white/10 transition";
  const pillActive =
    "bg-[rgba(207,174,93,0.18)] border-[rgba(207,174,93,0.35)] text-[rgba(245,246,248,0.95)]";

  const card =
    "rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_14px_40px_rgba(0,0,0,0.35)]";
  const innerCard = "rounded-2xl border border-white/10 bg-white/[0.03]";

  if (error) {
    return (
      <div className="mx-auto w-[min(1200px,94vw)] py-10 text-red-300">
        <div className={card + " p-6"}>Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-[min(1200px,94vw)] py-8">
      {/* header */}
      <motion.div {...fadeUp(0)} className="mb-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5">
                <Wallet className="h-5 w-5 text-[rgba(207,174,93,0.95)]" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-white">
                  Payouts
                </h1>
                <p className="text-sm text-white/60">
                  Review, audit, and pay crews. Create stubs, mark payouts paid,
                  and keep clean history.
                </p>
              </div>
            </div>
          </div>

          {/* mobile view switch */}
          <div className="flex items-center justify-between gap-2 md:hidden">
            <button
              onClick={() => setMobileView("payouts")}
              className={
                pillBase + " " + (mobileView === "payouts" ? pillActive : "")
              }
            >
              <BadgeDollarSign className="h-4 w-4" />
              Payouts
            </button>
            <button
              onClick={() => setMobileView("stubs")}
              className={
                pillBase + " " + (mobileView === "stubs" ? pillActive : "")
              }
            >
              <FileText className="h-4 w-4" />
              Stubs
            </button>
          </div>

          {/* desktop actions */}
          <div className="hidden items-center gap-2 md:flex">
            <button
              onClick={() => setDayRateOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-[rgba(207,174,93,0.95)] px-4 py-2 text-sm font-extrabold text-black shadow hover:brightness-110 transition"
            >
              <Users className="h-4 w-4" />
              Day-rate payout
            </button>

            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10 transition"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
      </motion.div>

      {/* KPI row */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid gap-3 md:grid-cols-5"
      >
        <motion.div variants={fadeUpItem} className={card + " p-4"}>
          <div className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Pending total
          </div>
          <div className="mt-2 text-2xl font-extrabold text-white">
            <CountUp end={kpis.pendingTotal / 100} decimals={2} prefix="$" />
          </div>
          <div className="mt-1 text-xs text-white/55">
            {kpis.pendingCount} pending payouts
          </div>
        </motion.div>

        <motion.div variants={fadeUpItem} className={card + " p-4"}>
          <div className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Paid total
          </div>
          <div className="mt-2 text-2xl font-extrabold text-white">
            <CountUp end={kpis.paidTotal / 100} decimals={2} prefix="$" />
          </div>
          <div className="mt-1 text-xs text-white/55">
            {kpis.paidCount} paid payouts
          </div>
        </motion.div>

        <motion.div variants={fadeUpItem} className={card + " p-4"}>
          <div className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Avg payout
          </div>
          <div className="mt-2 text-2xl font-extrabold text-white">
            <CountUp end={kpis.avgPayoutCents / 100} decimals={2} prefix="$" />
          </div>
          <div className="mt-1 text-xs text-white/55">All payouts</div>
        </motion.div>
      </motion.div>

      {/* main layout */}
      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* left: payouts */}
        <div
          className={
            card +
            " overflow-hidden " +
            (mobileView !== "payouts" ? "hidden md:block" : "")
          }
        >
          {/* controls */}
          <div className="border-b border-white/10 bg-white/[0.02] p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              {/* tabs */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setTab("all")}
                  className={pillBase + " " + (tab === "all" ? pillActive : "")}
                >
                  All
                </button>
                <button
                  onClick={() => setTab("pending")}
                  className={
                    pillBase + " " + (tab === "pending" ? pillActive : "")
                  }
                >
                  Pending
                </button>
                <button
                  onClick={() => setTab("paid")}
                  className={
                    pillBase + " " + (tab === "paid" ? pillActive : "")
                  }
                >
                  Paid
                </button>
              </div>

              {/* desktop action cluster (keeps header clean on small sizes) */}
              <div className="flex items-center gap-2 md:hidden">
                <button
                  onClick={() => setDayRateOpen(true)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[rgba(207,174,93,0.95)] px-3 py-2 text-xs font-extrabold text-black shadow hover:brightness-110 transition"
                >
                  Day-rate
                </button>
                <button
                  onClick={exportCsv}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/10 transition"
                >
                  <Download className="h-4 w-4" />
                  CSV
                </button>
              </div>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
              {/* search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search member or address…"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 py-2 pl-10 pr-3 text-sm text-white/90 placeholder:text-white/35 outline-none focus:border-[rgba(207,174,93,0.35)]"
                />
              </div>

              {/* dates */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  type="date"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/85 outline-none focus:border-[rgba(207,174,93,0.35)]"
                />
                <input
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  type="date"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/85 outline-none focus:border-[rgba(207,174,93,0.35)]"
                />
              </div>

              {/* filters */}
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/85 outline-none focus:border-[rgba(207,174,93,0.35)]"
                >
                  <option value="all">Member</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {(e as any).name || e.id}
                    </option>
                  ))}
                </select>

                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/85 outline-none focus:border-[rgba(207,174,93,0.35)]"
                >
                  <option value="all">Category</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/85 outline-none focus:border-[rgba(207,174,93,0.35)]"
                >
                  <option value="all">Method</option>
                  {methods.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-white/50">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <span>
                  Showing{" "}
                  <span className="text-white/80 font-semibold">
                    {paged.length}
                  </span>{" "}
                  of{" "}
                  <span className="text-white/80 font-semibold">
                    {filtered.length}
                  </span>
                </span>
              </div>

              <div className="hidden md:flex items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                  Page {pageSafe} / {pageCount}
                </span>
              </div>
            </div>
          </div>

          {/* list + sticky footer (Dashboard-style) */}
          <div className="relative">
            {/* scrolling list area */}
            <div
              ref={listTopRef}
              className="relative overflow-auto section-scroll max-h-[520px] lg:max-h-[600px]"
            >
              <div className="p-4">
                <div className={innerCard + " overflow-hidden"}>
                  <div className="grid grid-cols-[1fr_auto] border-b border-white/10 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-white/45">
                    <div>Payout</div>
                    <div className="text-right">Amount</div>
                  </div>

                  <div className="divide-y divide-white/10">
                    {paged.map((p) => {
                      const selected = selectedIds.includes(p.id);
                      const amountCents = Number((p as any).amountCents) || 0;

                      return (
                        <motion.div
                          key={p.id}
                          whileHover={{ y: -1 }}
                          transition={{ duration: 0.2, ease: EASE }}
                          className="flex items-stretch justify-between gap-3 px-4 py-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate text-sm font-bold text-white">
                                {getEmployeeDisplayName(p)}
                              </div>

                              <span
                                className={
                                  "rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide " +
                                  (isPaid(p)
                                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                                    : "border-[rgba(207,174,93,0.25)] bg-[rgba(207,174,93,0.12)] text-[rgba(245,246,248,0.9)]")
                                }
                              >
                                {isPaid(p) ? "paid" : "pending"}
                              </span>

                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/60">
                                {getCategory(p)}
                              </span>

                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/60">
                                {getMethod(p)}
                              </span>
                            </div>

                            <div className="mt-1 truncate text-xs text-white/55">
                              {getJobAddress(p) || "—"}
                            </div>

                            <div className="mt-1 text-[11px] text-white/45">
                              Created {fmtDateTime((p as any).createdAt)}
                              {isPaid(p) ? (
                                <span className="ml-2 text-emerald-200/70">
                                  • Paid {fmtDateTime((p as any).paidAt)}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-col items-end justify-between gap-2">
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-white/50">
                                Amount
                              </div>
                              <div className="text-sm font-extrabold text-white">
                                {money(amountCents)}
                              </div>
                            </div>

                            <button
                              onClick={() => toggleSelected(p.id)}
                              className={
                                "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-bold transition " +
                                (selected
                                  ? "border-[rgba(207,174,93,0.35)] bg-[rgba(207,174,93,0.18)] text-white"
                                  : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10")
                              }
                            >
                              {selected ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              {selected ? "Selected" : "Select"}
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}

                    {paged.length === 0 ? (
                      <div className="px-4 py-10 text-center text-sm text-white/55">
                        No payouts match your filters.
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* spacer so the last row isn't hidden behind sticky footer */}
                <div aria-hidden className="h-28" />
              </div>
            </div>

            {/* Sticky footer (selection actions + pagination always visible) */}
            <div className="sticky bottom-0 z-20 border-t border-white/10 bg-[rgba(11,14,20,0.88)] backdrop-blur">
              <AnimatePresence initial={false}>
                {selectedIds.length > 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    transition={{ duration: 0.22, ease: EASE }}
                    className="px-4 py-3"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="text-sm text-white/75">
                        Selected{" "}
                        <span className="font-extrabold text-white">
                          {selectedIds.length}
                        </span>{" "}
                        payout{selectedIds.length === 1 ? "" : "s"}.
                        {selectedEmployeeIds.length > 1 ? (
                          <span className="ml-2 inline-flex items-center gap-1 text-amber-200/80">
                            <AlertTriangle className="h-4 w-4" />
                            Select payouts for a single member to create a stub.
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={clearSelected}
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
                        >
                          <X className="h-4 w-4" />
                          Clear
                        </button>

                        <button
                          disabled={!canCreateStub}
                          onClick={() => setStubOpen(true)}
                          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500/20 px-4 py-2 text-sm font-extrabold text-emerald-100 border border-emerald-400/25 hover:bg-emerald-500/25 transition disabled:opacity-40"
                        >
                          <FileText className="h-4 w-4" />
                          Create stub
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {/* pagination row */}
              <div className="px-4 py-3">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <div>
                    Showing{" "}
                    <span className="text-white/85 font-semibold">
                      {(pageSafe - 1) * PER_PAGE + (paged.length ? 1 : 0)}–
                      {(pageSafe - 1) * PER_PAGE + paged.length}
                    </span>{" "}
                    of{" "}
                    <span className="text-white/85 font-semibold">
                      {filtered.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      disabled={pageSafe <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 font-semibold text-white/80 disabled:opacity-40 hover:bg-white/10 transition"
                    >
                      Prev
                    </button>

                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                      Page{" "}
                      <span className="text-white/85 font-semibold">
                        {pageSafe}
                      </span>{" "}
                      / {pageCount}
                    </div>

                    <button
                      disabled={pageSafe >= pageCount}
                      onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 font-semibold text-white/80 disabled:opacity-40 hover:bg-white/10 transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* right: stub history */}
        <div
          className={
            card +
            " overflow-hidden " +
            (mobileView !== "stubs" ? "hidden md:block" : "")
          }
        >
          <div className="border-b border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-2xl border border-white/10 bg-white/5">
                  <FileText className="h-4 w-4 text-[rgba(207,174,93,0.95)]" />
                </div>
                <div>
                  <div className="text-sm font-extrabold text-white">
                    Stub history
                  </div>
                  <div className="text-xs text-white/55">
                    Printable records created when payouts are marked paid.
                  </div>
                </div>
              </div>

              <div className="hidden md:block text-xs text-white/55">
                {stubs.length} stub{stubs.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          <div className="p-4">
            <div className="space-y-2">
              {stubs.slice(0, 12).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setViewStubId(s.id)}
                  className="w-full text-left rounded-2xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold text-white">
                        {(s as any).number ||
                          `Stub ${s.id.slice(0, 6).toUpperCase()}`}
                      </div>
                      <div className="truncate text-xs text-white/55">
                        {(s as any).employeeNameSnapshot || "Member"} •{" "}
                        {money((s as any).totalCents || 0)}
                      </div>
                    </div>
                    <div className="text-[11px] text-white/45">
                      {fmtDate((s as any).paidAt)}
                    </div>
                  </div>
                </button>
              ))}

              {stubs.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/55">
                  No stubs yet. Select payouts and create a stub when you mark
                  them paid.
                </div>
              ) : null}
            </div>

            {/* hint */}
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
              Tip: Use filters on the left to isolate a week/pay period, then
              create a stub for a single member.
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {/* Create Stub modal */}
        {stubOpen && (
          <GlobalPayoutStubModal
            payouts={selectedPayouts}
            employee={stubEmployee}
            saving={stubSaving}
            onClose={() => setStubOpen(false)}
            onConfirmPaid={markSelectedAsPaidAndCreateStub}
          />
        )}

        {/* View Stub modal */}
        {viewStubStub && (
          <PayoutStubViewerModal
            stub={viewStubStub}
            employeeNameOverride={
              (viewEmployee as any)?.name ||
              (viewStubStub as any)?.employeeNameSnapshot ||
              undefined
            }
            onClose={() => setViewStubId(null)}
          />
        )}

        {/* Day-rate payout modal */}
        {dayRateOpen && orgId && (
          <PayTechnicianModal
            orgId={orgId}
            onClose={() => setDayRateOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
