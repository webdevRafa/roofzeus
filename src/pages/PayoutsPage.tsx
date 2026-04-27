// src/pages/PayoutsPage.tsx
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import {
  AnimatePresence,
  motion,
  type MotionProps,
  type Variants,
} from "framer-motion";
import CountUp from "react-countup";
import {
  AlertTriangle,
  BadgeDollarSign,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Filter,
  ReceiptText,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { db } from "../firebase/firebaseConfig";
import { useOrg } from "../contexts/OrgContext";
import type { Employee, PayoutDoc, PayoutStubDoc } from "../types/types";
import { useDashboardPayoutsData } from "../hooks/useDashboardPayoutsData";
import { GlobalPayoutStubModal } from "../components/GlobalPayoutStubModal";
import { PayoutStubViewerModal } from "../components/PayoutStubViewerModal";
import PayTechnicianModal from "../components/PayTechnicianModal";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
};

const fadeUpItem: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(5px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.36, ease: EASE },
  },
};

const fadeUp = (delay = 0): Partial<MotionProps> => ({
  initial: { opacity: 0, y: 10, filter: "blur(5px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.36, ease: EASE, delay },
});

type FsTimestampLike = { toDate: () => Date };
type PayoutFilter = "all" | "pending" | "paid";
type MobileView = "payouts" | "stubs";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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
  return new Date(ms).toLocaleString(undefined, {
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
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function money(cents?: number | null): string {
  const value = typeof cents === "number" ? cents : 0;
  return (value / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function ymd(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeText(v: unknown) {
  return typeof v === "string" ? v : "";
}

function getEmployeeDisplayName(p: PayoutDoc) {
  return (
    safeText((p as any).employeeNameSnapshot) ||
    safeText((p as any).payeeNickname) ||
    "Unknown member"
  );
}

function getJobAddress(p: PayoutDoc) {
  const address: any = (p as any).jobAddressSnapshot;
  if (!address) return "";
  if (typeof address === "string") return address;
  if (typeof address === "object") {
    return (
      address.display ||
      address.fullLine ||
      address.line1 ||
      address.address ||
      ""
    );
  }
  return "";
}

function getCategory(p: PayoutDoc) {
  return safeText((p as any).category) || "unknown";
}

function categoryLabel(category: string) {
  if (category === "felt") return "Dry In";
  if (category === "shingles") return "Shingles";
  if (category === "technician") return "Day Rate";
  return category || "Unknown";
}

function getMethod(p: PayoutDoc) {
  return safeText((p as any).method) || "check";
}

function methodLabel(method: string) {
  if (!method) return "Unknown";
  return method.charAt(0).toUpperCase() + method.slice(1);
}

function isPaid(p: PayoutDoc) {
  return Boolean((p as any).paidAt);
}

function dateInRange(
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
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function KpiCard({
  label,
  valueCents,
  value,
  sub,
}: {
  label: string;
  valueCents?: number;
  value?: number;
  sub: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <motion.div
      variants={fadeUpItem}
      whileHover={{ y: -2, transition: { duration: 0.2, ease: EASE } }}
      className="rounded-2xl  p-4 shadow-sm transition hover:bg-[var(--color-card-hover)] hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.62)]">
            {label}
          </div>
          <div className="mt-2 text-xl font-poppins leading-none text-[var(--color-text)]">
            {typeof valueCents === "number" ? (
              <CountUp
                end={valueCents / 100}
                decimals={2}
                prefix="$"
                separator=","
                duration={0.65}
              />
            ) : (
              <CountUp end={value ?? 0} separator="," duration={0.65} />
            )}
          </div>
          <div className="mt-2 text-xs text-[rgb(var(--color-text-rgb)/0.56)]">
            {sub}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatusPill({ paid }: { paid: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
        paid
          ? "border-[rgb(var(--pill-success-rgb)/0.30)] bg-[rgb(var(--pill-success-rgb)/0.12)] text-[rgb(var(--pill-success-rgb))]"
          : "border-[rgb(var(--color-primary-rgb)/0.32)] bg-[rgb(var(--color-primary-rgb)/0.12)] text-[var(--color-primary)]"
      )}
    >
      {paid ? "Paid" : "Pending"}
    </span>
  );
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:shadow-sm",
        active
          ? "border-[rgb(var(--color-primary-rgb)/0.36)] bg-[rgb(var(--color-primary-rgb)/0.12)] text-[var(--color-primary)]"
          : "border-none text-[rgb(var(--color-text-rgb)/0.68)]  hover:text-[rgb(var(--color-text-rgb)/0.90)]"
      )}
    >
      {children}
    </button>
  );
}

function SelectShell({
  value,
  onChange,
  children,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.58)] px-3 text-xs font-semibold text-[var(--color-text)] outline-none transition hover:bg-[rgb(var(--color-surface-rgb)/0.75)] focus:border-[rgb(var(--color-primary-rgb)/0.42)] focus:ring-2 focus:ring-[rgb(var(--color-primary-rgb)/0.12)]"
      >
        {children}
      </select>
    </label>
  );
}

export default function PayoutsPage() {
  const navigate = useNavigate();
  const { orgId, loading: orgLoading } = useOrg();

  const {
    payouts,
    payoutsLoading,
    payoutsError,
    payoutFilter,
    setPayoutFilter,
    payoutSearch,
    setPayoutSearch,
    payoutsPage,
    setPayoutsPage,
    selectedPayoutIds,
    selectedEmployeeIds,
    selectedPayouts,
    canCreateStub,
    togglePayoutSelected,
    clearSelectedPayouts,
    stubOpen,
    setStubOpen,
    stubSaving,
    stubEmployee,
    markSelectedPayoutsAsPaid,
  } = useDashboardPayoutsData();

  const [stubs, setStubs] = useState<PayoutStubDoc[]>([]);
  const [stubsReady, setStubsReady] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>("payouts");
  const [category, setCategory] = useState("all");
  const [method, setMethod] = useState("all");
  const [employeeId, setEmployeeId] = useState("all");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [viewStubId, setViewStubId] = useState<string | null>(null);
  const [dayRateOpen, setDayRateOpen] = useState(false);
  const [dismissFirstStubGuide, setDismissFirstStubGuide] = useState(false);

  const selectedOneMember =
    selectedPayoutIds.length > 0 && selectedEmployeeIds.length === 1;

  const listTopRef = useRef<HTMLDivElement | null>(null);
  const PER_PAGE = 10;

  useEffect(() => {
    if (orgLoading) return;
    if (!orgId) {
      setStubs([]);
      setEmployees([]);
      setStubsReady(true);
      return;
    }
    setStubsReady(false);

    setLocalError(null);

    const stubsQ = query(
      collection(db, "organizations", orgId, "payoutStubs"),
      orderBy("paidAt", "desc")
    );
    const employeesQ = query(
      collection(db, "organizations", orgId, "employees"),
      orderBy("name", "asc")
    );

    const unsubStubs = onSnapshot(
      stubsQ,
      (snap) => {
        setStubs(
          snap.docs.map(
            (d) => ({ id: d.id, ...(d.data() as any) } as PayoutStubDoc)
          )
        );
        setStubsReady(true);
      },
      (err) => {
        setLocalError(err.message || String(err));
        setStubsReady(true);
      }
    );

    const unsubEmployees = onSnapshot(
      employeesQ,
      (snap) =>
        setEmployees(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Employee))
        ),
      (err) => setLocalError(err.message || String(err))
    );

    return () => {
      unsubStubs();
      unsubEmployees();
    };
  }, [orgId, orgLoading]);

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
  }, [viewStubId, stubOpen, dayRateOpen, setStubOpen]);

  const selectedStub = useMemo(() => {
    if (!viewStubId) return null;
    return stubs.find((stub) => stub.id === viewStubId) ?? null;
  }, [stubs, viewStubId]);

  const selectedStubEmployee = useMemo(() => {
    if (!selectedStub?.employeeId) return null;
    return (
      employees.find((employee) => employee.id === selectedStub.employeeId) ??
      null
    );
  }, [employees, selectedStub]);

  const startMs = useMemo(
    () => (dateStart ? new Date(`${dateStart}T00:00:00`).getTime() : null),
    [dateStart]
  );
  const endMs = useMemo(
    () => (dateEnd ? new Date(`${dateEnd}T23:59:59.999`).getTime() : null),
    [dateEnd]
  );

  const filtered = useMemo(() => {
    const search = payoutSearch.trim().toLowerCase();

    return payouts.filter((p) => {
      if (payoutFilter === "pending" && isPaid(p)) return false;
      if (payoutFilter === "paid" && !isPaid(p)) return false;

      if (search) {
        const haystack = [
          getEmployeeDisplayName(p),
          getJobAddress(p),
          getCategory(p),
          getMethod(p),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      if (employeeId !== "all" && (p as any).employeeId !== employeeId)
        return false;
      if (category !== "all" && getCategory(p) !== category) return false;
      if (method !== "all" && getMethod(p) !== method) return false;

      if (startMs != null || endMs != null) {
        if (!dateInRange(toMillis((p as any).createdAt), startMs, endMs))
          return false;
      }

      return true;
    });
  }, [
    payouts,
    payoutFilter,
    payoutSearch,
    employeeId,
    category,
    method,
    startMs,
    endMs,
  ]);

  useEffect(() => {
    setPayoutsPage(1);
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [
    payoutFilter,
    payoutSearch,
    employeeId,
    category,
    method,
    dateStart,
    dateEnd,
    setPayoutsPage,
  ]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(filtered.length / PER_PAGE)),
    [filtered.length]
  );
  const pageSafe = clamp(payoutsPage, 1, pageCount);

  const paged = useMemo(() => {
    const start = (pageSafe - 1) * PER_PAGE;
    return filtered.slice(start, start + PER_PAGE);
  }, [filtered, pageSafe]);

  const showFirstPaystubGuide =
    stubsReady &&
    stubs.length === 0 &&
    !dismissFirstStubGuide &&
    payoutFilter === "pending" &&
    filtered.some((p) => !isPaid(p));

  const firstStubGuideStep: "select" | "create" | null = showFirstPaystubGuide
    ? selectedOneMember
      ? "create"
      : "select"
    : null;

  const firstGuidedPendingPayoutId = useMemo(() => {
    if (!showFirstPaystubGuide) return null;
    return paged.find((p) => !isPaid(p))?.id ?? null;
  }, [paged, showFirstPaystubGuide]);

  const kpis = useMemo(() => {
    const pending = payouts.filter((p) => !isPaid(p));
    const paid = payouts.filter((p) => isPaid(p));
    const sum = (rows: PayoutDoc[]) =>
      rows.reduce(
        (total, p) => total + (Number((p as any).amountCents) || 0),
        0
      );
    const avg = (rows: PayoutDoc[]) =>
      rows.length ? Math.round(sum(rows) / rows.length) : 0;

    return {
      pendingCount: pending.length,
      paidCount: paid.length,
      pendingTotal: sum(pending),
      paidTotal: sum(paid),
      avgPayoutCents: avg(payouts),
      avgPendingCents: avg(pending),
      stubCount: stubs.length,
    };
  }, [payouts, stubs.length]);

  const categories = useMemo(
    () => Array.from(new Set(payouts.map(getCategory))).sort(),
    [payouts]
  );
  const methods = useMemo(
    () => Array.from(new Set(payouts.map(getMethod))).sort(),
    [payouts]
  );

  const selectedTotalCents = useMemo(
    () =>
      selectedPayouts.reduce(
        (sum, payout) => sum + (Number((payout as any).amountCents) || 0),
        0
      ),
    [selectedPayouts]
  );

  const activeFilterCount = [
    employeeId !== "all",
    category !== "all",
    method !== "all",
    Boolean(dateStart),
    Boolean(dateEnd),
  ].filter(Boolean).length;

  function resetFilters() {
    setEmployeeId("all");
    setCategory("all");
    setMethod("all");
    setDateStart("");
    setDateEnd("");
    setPayoutSearch("");
    setPayoutFilter("pending" as PayoutFilter);
  }

  function exportCsv() {
    const rows = filtered.map((p) => ({
      id: p.id,
      employee: getEmployeeDisplayName(p),
      address: getJobAddress(p),
      category: categoryLabel(getCategory(p)),
      method: methodLabel(getMethod(p)),
      amount: ((Number((p as any).amountCents) || 0) / 100).toFixed(2),
      status: isPaid(p) ? "paid" : "pending",
      createdAt: fmtDateTime((p as any).createdAt),
      paidAt: (p as any).paidAt ? fmtDateTime((p as any).paidAt) : "",
      payoutStubId: (p as any).payoutStubId || (p as any).stubId || "",
    }));

    const headers = [
      "id",
      "employee",
      "address",
      "category",
      "method",
      "amount",
      "status",
      "createdAt",
      "paidAt",
      "payoutStubId",
    ];
    const body = rows
      .map((row) =>
        headers
          .map(
            (key) =>
              `"${String((row as any)[key] ?? "").replaceAll('"', '""')}"`
          )
          .join(",")
      )
      .join("\n");

    downloadText(
      `payouts_${ymd(new Date())}.csv`,
      `${headers.join(",")}\n${body}`
    );
  }

  const error = payoutsError || localError;

  if (orgLoading || payoutsLoading) {
    return (
      <div className="mx-auto w-[min(1200px,94vw)] py-10 text-[rgb(var(--color-text-rgb)/0.70)]">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
          Loading payouts…
        </div>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="mx-auto w-[min(1200px,94vw)] py-10 text-red-300">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
          You are not linked to an organization.
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-[min(1200px,94vw)] py-10 text-red-300">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-[min(1450px,94vw)]">
      <motion.header {...fadeUp(0)} className="mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-xs md:text-md lg:text-lg font-semibold text-[var(--color-text)] uppercase font-poppins">
              Payouts
            </h1>
            <p className="mt-0 max-w-2xl text-xs text-[rgb(var(--color-text-rgb)/0.58)]">
              Track pending and paid payouts, create clean pay stubs, and export
              the filtered payout ledger.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
            <div className="grid grid-cols-2 gap-2 md:hidden">
              <button
                type="button"
                onClick={() => setMobileView("payouts")}
                className={cx(
                  "inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                  mobileView === "payouts"
                    ? "border-[rgb(var(--color-primary-rgb)/0.36)] bg-[rgb(var(--color-primary-rgb)/0.12)] text-[var(--color-primary)]"
                    : "border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] text-[rgb(var(--color-text-rgb)/0.70)]"
                )}
              >
                <BadgeDollarSign className="h-4 w-4" /> Payouts
              </button>
              <button
                type="button"
                onClick={() => setMobileView("stubs")}
                className={cx(
                  "inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                  mobileView === "stubs"
                    ? "border-[rgb(var(--color-primary-rgb)/0.36)] bg-[rgb(var(--color-primary-rgb)/0.12)] text-[var(--color-primary)]"
                    : "border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] text-[rgb(var(--color-text-rgb)/0.70)]"
                )}
              >
                <FileText className="h-4 w-4" /> Stubs
              </button>
            </div>

            <button
              type="button"
              onClick={() => setDayRateOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[rgb(var(--color-primary-rgb)/0.28)] bg-[rgb(var(--color-primary-rgb)/0.12)] px-4 py-2 text-sm font-bold text-[var(--color-primary)] shadow-sm transition hover:bg-[rgb(var(--color-primary-rgb)/0.18)] hover:shadow-md"
            >
              <Users className="h-4 w-4" />
              Day-rate payout
            </button>

            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-4 py-2 text-sm font-semibold text-[rgb(var(--color-text-rgb)/0.82)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.76)] hover:text-[var(--color-text)]"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
      </motion.header>

      <motion.section
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
      >
        <KpiCard
          icon={AlertTriangle}
          label="Pending total"
          valueCents={kpis.pendingTotal}
          sub={`${kpis.pendingCount} pending payout${
            kpis.pendingCount === 1 ? "" : "s"
          }`}
        />
        <KpiCard
          icon={CheckCircle2}
          label="Paid total"
          valueCents={kpis.paidTotal}
          sub={`${kpis.paidCount} paid payout${
            kpis.paidCount === 1 ? "" : "s"
          }`}
        />
        <KpiCard
          icon={BadgeDollarSign}
          label="Avg payout"
          valueCents={kpis.avgPayoutCents}
          sub="All payouts"
        />
        <KpiCard
          icon={ReceiptText}
          label="Avg pending"
          valueCents={kpis.avgPendingCents}
          sub="Pending only"
        />
        <KpiCard
          icon={FileText}
          label="Stub count"
          value={kpis.stubCount}
          sub="Payout stub history"
        />
      </motion.section>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <motion.section
          {...fadeUp(0.05)}
          className={cx(
            "overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm",
            mobileView !== "payouts" && "hidden md:block"
          )}
        >
          <div
            ref={listTopRef}
            className="border-b border-[var(--color-border)] bg-[rgb(var(--color-surface-rgb)/0.18)] p-4"
          >
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <FilterButton
                  active={payoutFilter === "all"}
                  onClick={() => setPayoutFilter("all" as PayoutFilter)}
                >
                  All
                </FilterButton>
                <FilterButton
                  active={payoutFilter === "pending"}
                  onClick={() => setPayoutFilter("pending" as PayoutFilter)}
                >
                  Pending
                </FilterButton>
                <FilterButton
                  active={payoutFilter === "paid"}
                  onClick={() => setPayoutFilter("paid" as PayoutFilter)}
                >
                  Paid
                </FilterButton>
              </div>

              <div className="flex items-center gap-2 text-xs text-[rgb(var(--color-text-rgb)/0.58)]">
                <Filter className="h-4 w-4" />
                <span>
                  Showing{" "}
                  <span className="font-bold text-[var(--color-text)]">
                    {filtered.length}
                  </span>{" "}
                  payout{filtered.length === 1 ? "" : "s"}
                </span>
                {activeFilterCount > 0 ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="ml-1 font-semibold text-[var(--color-primary)] hover:underline"
                  >
                    Reset filters
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid gap-2 2xl:grid-cols-[minmax(260px,1fr)_minmax(250px,0.75fr)_minmax(420px,1fr)]">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--color-text-rgb)/0.45)]" />
                <input
                  value={payoutSearch}
                  onChange={(e) => setPayoutSearch(e.target.value)}
                  placeholder="Search member, address, category…"
                  className="h-10 w-full rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.58)] pl-10 pr-3 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[rgb(var(--color-text-rgb)/0.36)] hover:bg-[rgb(var(--color-surface-rgb)/0.75)] focus:border-[rgb(var(--color-primary-rgb)/0.42)] focus:ring-2 focus:ring-[rgb(var(--color-primary-rgb)/0.12)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  type="date"
                  className="h-10 min-w-0 rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.58)] px-3 text-xs font-semibold text-[var(--color-text)] outline-none transition hover:bg-[rgb(var(--color-surface-rgb)/0.75)] focus:border-[rgb(var(--color-primary-rgb)/0.42)] focus:ring-2 focus:ring-[rgb(var(--color-primary-rgb)/0.12)]"
                />
                <input
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  type="date"
                  className="h-10 min-w-0 rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.58)] px-3 text-xs font-semibold text-[var(--color-text)] outline-none transition hover:bg-[rgb(var(--color-surface-rgb)/0.75)] focus:border-[rgb(var(--color-primary-rgb)/0.42)] focus:ring-2 focus:ring-[rgb(var(--color-primary-rgb)/0.12)]"
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <SelectShell
                  label="Member"
                  value={employeeId}
                  onChange={setEmployeeId}
                >
                  <option
                    value="all"
                    className="bg-[var(--color-surface)] text-[var(--color-text)]"
                  >
                    Member
                  </option>
                  {employees.map((employee) => (
                    <option
                      key={employee.id}
                      value={employee.id}
                      className="bg-[var(--color-surface)] text-[var(--color-text)]"
                    >
                      {employee.name || employee.id}
                    </option>
                  ))}
                </SelectShell>

                <SelectShell
                  label="Category"
                  value={category}
                  onChange={setCategory}
                >
                  <option
                    value="all"
                    className="bg-[var(--color-surface)] text-[var(--color-text)]"
                  >
                    Category
                  </option>
                  {categories.map((c) => (
                    <option
                      key={c}
                      value={c}
                      className="bg-[var(--color-surface)] text-[var(--color-text)]"
                    >
                      {categoryLabel(c)}
                    </option>
                  ))}
                </SelectShell>

                <SelectShell label="Method" value={method} onChange={setMethod}>
                  <option
                    value="all"
                    className="bg-[var(--color-surface)] text-[var(--color-text)]"
                  >
                    Method
                  </option>
                  {methods.map((m) => (
                    <option
                      key={m}
                      value={m}
                      className="bg-[var(--color-surface)] text-[var(--color-text)]"
                    >
                      {methodLabel(m)}
                    </option>
                  ))}
                </SelectShell>
              </div>
            </div>
          </div>

          <div className="max-h-[66vh] overflow-y-auto p-4 section-scroll">
            <div className="overflow-hidden ">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] border-b border-[rgb(var(--color-border-rgb)/0.16)] px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.62)]">
                <div>Payout</div>
                <div className="text-right">Amount</div>
              </div>

              <div className="divide-y divide-[rgb(var(--color-border-rgb)/0.16)]">
                {paged.map((p) => {
                  const selected = selectedPayoutIds.includes(p.id);
                  const paid = isPaid(p);
                  const amountCents = Number((p as any).amountCents) || 0;
                  const canSelect = !paid;
                  const showSelectGuide =
                    firstStubGuideStep === "select" &&
                    firstGuidedPendingPayoutId === p.id &&
                    canSelect;
                  return (
                    <motion.div
                      key={p.id}
                      transition={{ duration: 0.18, ease: EASE }}
                      className={cx(
                        "grid gap-3 px-4 py-4 transition md:grid-cols-[minmax(0,1fr)_auto] md:items-center",
                        selected
                          ? "bg-[var(--color-card-hover)]"
                          : "hover:bg-[var(--color-card-hover)]"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-sm font-extrabold text-[var(--color-text)]">
                            {getEmployeeDisplayName(p)}
                          </div>
                          <StatusPill paid={paid} />
                          <span className="rounded-full border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.72)]">
                            {categoryLabel(getCategory(p))}
                          </span>
                          <span className="rounded-full border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.72)]">
                            {methodLabel(getMethod(p))}
                          </span>
                        </div>

                        <div className="mt-2 truncate text-sm text-[rgb(var(--color-text-rgb)/0.82)]">
                          {getJobAddress(p) || "No job address saved"}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[rgb(var(--color-text-rgb)/0.54)]">
                          <span>
                            Created {fmtDateTime((p as any).createdAt)}
                          </span>
                          {paid ? (
                            <span className="text-[rgb(var(--pill-success-rgb)/0.82)]">
                              Paid {fmtDateTime((p as any).paidAt)}
                            </span>
                          ) : null}
                          {(p as any).sqft && (p as any).ratePerSqFt ? (
                            <span>
                              {(p as any).sqft} sq.ft × $
                              {Number((p as any).ratePerSqFt).toFixed(2)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 md:flex-col md:items-end">
                        <div className="rounded-xl border border-[rgb(var(--color-border-rgb)/0.16)] bg-[rgb(var(--color-background-rgb)/0.22)] px-3 py-2 text-right">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.52)]">
                            Amount
                          </div>
                          <div className="text-base font-extrabold text-[var(--color-text)]">
                            {money(amountCents)}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {(p as any).jobId ? (
                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/job/${(p as any).jobId}`)
                              }
                              className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.45)] px-3 py-2 text-xs font-bold text-[rgb(var(--color-text-rgb)/0.78)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.72)] hover:text-[var(--color-text)]"
                            >
                              View job
                            </button>
                          ) : null}

                          <div
                            className={cx(
                              "relative inline-flex",
                              showSelectGuide && "z-40"
                            )}
                          >
                            {showSelectGuide ? (
                              <motion.span
                                aria-hidden="true"
                                className="pointer-events-none absolute -inset-1.5 rounded-2xl border border-[rgb(var(--color-primary-rgb)/0.55)] bg-[rgb(var(--color-primary-rgb)/0.08)]"
                                animate={{
                                  opacity: [0.55, 1, 0.55],
                                  scale: [1, 1.045, 1],
                                }}
                                transition={{
                                  duration: 1.8,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                }}
                              />
                            ) : null}

                            <button
                              type="button"
                              disabled={!canSelect}
                              onClick={() => togglePayoutSelected(p.id)}
                              className={cx(
                                "relative z-10 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40",
                                showSelectGuide
                                  ? "border-[rgb(var(--color-primary-rgb)/0.55)] bg-[rgb(var(--color-primary-rgb)/0.14)] text-[var(--color-primary)] shadow-[0_12px_30px_rgb(var(--color-primary-rgb)/0.18)] hover:bg-[rgb(var(--color-primary-rgb)/0.18)]"
                                  : selected
                                  ? "border-[rgb(var(--color-primary-rgb)/0.38)] bg-[rgb(var(--color-primary-rgb)/0.14)] text-[var(--color-primary)]"
                                  : "border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.45)] text-[rgb(var(--color-text-rgb)/0.78)] hover:bg-[rgb(var(--color-surface-rgb)/0.72)] hover:text-[var(--color-text)]"
                              )}
                            >
                              {selected ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}

                              {selected ? "Selected" : paid ? "Paid" : "Select"}
                            </button>

                            {showSelectGuide ? (
                              <motion.div
                                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                                transition={{ duration: 0.2, ease: EASE }}
                                className="absolute right-0 top-full z-50 mt-3 w-[320px] rounded-2xl border border-[rgb(var(--color-primary-rgb)/0.28)] bg-[var(--color-card)] p-4 text-left shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
                              >
                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[rgb(var(--color-primary-rgb)/0.28)] bg-[rgb(var(--color-primary-rgb)/0.12)] text-[var(--color-primary)]">
                                    <ChevronRight className="h-4 w-4" />
                                  </div>

                                  <div className="min-w-0">
                                    <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-primary)]">
                                      Step 1 of 2
                                    </div>

                                    <div className="mt-1 text-sm font-extrabold text-[var(--color-text)]">
                                      Select a pending payout
                                    </div>

                                    <p className="mt-1 text-xs leading-5 text-[rgb(var(--color-text-rgb)/0.64)]">
                                      Choose one or more payouts for the same
                                      member. This is how you start creating
                                      your first pay stub.
                                    </p>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDismissFirstStubGuide(true)
                                      }
                                      className="mt-3 text-[11px] font-semibold text-[rgb(var(--color-text-rgb)/0.48)] hover:text-[var(--color-text)]"
                                    >
                                      Not now
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {paged.length === 0 ? (
                  <div className="px-4 py-12 text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)]">
                      <Search className="h-5 w-5 text-[rgb(var(--color-text-rgb)/0.45)]" />
                    </div>
                    <div className="mt-3 text-sm font-semibold text-[var(--color-text)]">
                      No payouts found
                    </div>
                    <div className="mt-1 text-xs text-[rgb(var(--color-text-rgb)/0.55)]">
                      Try clearing filters or switching between pending and
                      paid.
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 z-20 border-t border-[var(--color-border)] bg-[rgb(var(--color-surface-rgb)/0.18)] backdrop-blur-xl">
            <AnimatePresence initial={false}>
              {selectedPayoutIds.length > 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ duration: 0.22, ease: EASE }}
                  className="border-b border-[rgb(var(--color-border-rgb)/0.14)] px-4 py-3"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="text-sm text-[rgb(var(--color-text-rgb)/0.72)]">
                      <span className="font-bold text-[var(--color-text)]">
                        {selectedPayoutIds.length}
                      </span>{" "}
                      selected • {money(selectedTotalCents)} total
                      {selectedEmployeeIds.length > 1 ? (
                        <span className="mt-1 flex items-center gap-1 text-amber-300/85 sm:mt-0 sm:inline-flex sm:pl-2">
                          <AlertTriangle className="h-4 w-4" /> Select one
                          member only to create a stub.
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={clearSelectedPayouts}
                        className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.45)] px-4 py-2 text-sm font-semibold text-[rgb(var(--color-text-rgb)/0.75)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.72)]"
                      >
                        <X className="h-4 w-4" /> Clear
                      </button>
                      <div
                        className={cx(
                          "relative",
                          firstStubGuideStep === "create" && "z-50"
                        )}
                      >
                        <button
                          type="button"
                          disabled={!canCreateStub}
                          onClick={() => setStubOpen(true)}
                          className={cx(
                            "relative inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40",
                            firstStubGuideStep === "create"
                              ? "border-[rgb(var(--pill-success-rgb)/0.75)] bg-[rgb(var(--pill-success-rgb)/0.22)] text-[rgb(var(--pill-success-rgb))] shadow-[0_0_0_6px_rgb(var(--pill-success-rgb)/0.10),0_0_34px_rgb(var(--pill-success-rgb)/0.36)]"
                              : "border-[rgb(var(--pill-success-rgb)/0.30)] bg-[rgb(var(--pill-success-rgb)/0.14)] text-[rgb(var(--pill-success-rgb))] hover:bg-[rgb(var(--pill-success-rgb)/0.20)]"
                          )}
                        >
                          {firstStubGuideStep === "create" ? (
                            <span className="pointer-events-none absolute -inset-2 -z-10 rounded-2xl bg-[rgb(var(--pill-success-rgb)/0.14)] animate-pulse" />
                          ) : null}
                          <FileText className="h-4 w-4" /> Create stub
                        </button>

                        {firstStubGuideStep === "create" ? (
                          <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.98 }}
                            transition={{ duration: 0.2, ease: EASE }}
                            className="absolute bottom-full right-0 z-50 mb-3 w-[320px] rounded-2xl border border-[rgb(var(--pill-success-rgb)/0.30)] bg-[var(--color-card)] p-4 text-left shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
                          >
                            <div className="text-[11px] font-bold uppercase tracking-wide text-[rgb(var(--pill-success-rgb))]">
                              Step 2 of 2
                            </div>
                            <div className="mt-1 text-sm font-extrabold text-[var(--color-text)]">
                              Create the pay stub
                            </div>
                            <p className="mt-1 text-xs leading-5 text-[rgb(var(--color-text-rgb)/0.64)]">
                              Now generate the printable stub. After review, you
                              can mark these payouts as paid.
                            </p>
                            <button
                              type="button"
                              onClick={() => setDismissFirstStubGuide(true)}
                              className="mt-3 text-[11px] font-semibold text-[rgb(var(--color-text-rgb)/0.48)] hover:text-[var(--color-text)]"
                            >
                              Not now
                            </button>
                          </motion.div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-[rgb(var(--color-text-rgb)/0.58)]">
                Showing{" "}
                <span className="font-bold text-[rgb(var(--color-text-rgb)/0.86)]">
                  {(pageSafe - 1) * PER_PAGE + (paged.length ? 1 : 0)}–
                  {(pageSafe - 1) * PER_PAGE + paged.length}
                </span>{" "}
                of{" "}
                <span className="font-bold text-[rgb(var(--color-text-rgb)/0.86)]">
                  {filtered.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pageSafe <= 1}
                  onClick={() => setPayoutsPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.45)] px-3 py-2 text-xs font-bold text-[rgb(var(--color-text-rgb)/0.72)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.72)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </button>
                <div className="rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.45)] px-3 py-2 text-xs font-semibold text-[rgb(var(--color-text-rgb)/0.72)]">
                  Page{" "}
                  <span className="text-[var(--color-text)]">{pageSafe}</span> /{" "}
                  {pageCount}
                </div>
                <button
                  type="button"
                  disabled={pageSafe >= pageCount}
                  onClick={() =>
                    setPayoutsPage((p) => Math.min(pageCount, p + 1))
                  }
                  className="inline-flex items-center gap-1 rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.45)] px-3 py-2 text-xs font-bold text-[rgb(var(--color-text-rgb)/0.72)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.72)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.aside
          {...fadeUp(0.08)}
          className={cx(
            "overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm",
            mobileView !== "stubs" && "hidden md:block"
          )}
        >
          <div className="border-b border-[var(--color-border)] bg-[rgb(var(--color-surface-rgb)/0.18)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[rgb(var(--color-primary-rgb)/0.24)] bg-[rgb(var(--color-primary-rgb)/0.10)]">
                  <FileText className="h-5 w-5 text-[var(--color-primary)]" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-[var(--color-text)]">
                    Stub history
                  </div>
                  <div className="text-xs text-[rgb(var(--color-text-rgb)/0.58)]">
                    Printable records created after payouts are marked paid.
                  </div>
                </div>
              </div>
              <div className="rounded-full border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.45)] px-2.5 py-1 text-xs font-bold text-[rgb(var(--color-text-rgb)/0.72)]">
                {stubs.length}
              </div>
            </div>
          </div>

          <div className="max-h-[66vh] overflow-y-auto p-4 section-scroll">
            <div className="space-y-2">
              {stubs.slice(0, 18).map((stub) => (
                <button
                  key={stub.id}
                  type="button"
                  onClick={() => setViewStubId(stub.id)}
                  className="w-full rounded-2xl border border-[rgb(var(--color-border-rgb)/0.16)] bg-[rgb(var(--color-surface-rgb)/0.28)] p-3 text-left transition hover:bg-[rgb(var(--color-surface-rgb)/0.48)] hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold text-[var(--color-text)]">
                        {(stub as any).number ||
                          `Stub ${stub.id.slice(0, 6).toUpperCase()}`}
                      </div>
                      <div className="mt-1 flex items-center gap-1 truncate text-xs text-[rgb(var(--color-text-rgb)/0.62)]">
                        <UserRound className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {(stub as any).employeeNameSnapshot || "Member"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-extrabold text-[var(--color-text)]">
                        {money((stub as any).totalCents || 0)}
                      </div>
                      <div className="mt-1 text-[11px] text-[rgb(var(--color-text-rgb)/0.48)]">
                        {fmtDate(
                          (stub as any).paidAt || (stub as any).createdAt
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}

              {stubs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-surface-rgb)/0.24)] p-6 text-center">
                  <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-[rgb(var(--color-primary-rgb)/0.22)] bg-[rgb(var(--color-primary-rgb)/0.08)]">
                    <FileText className="h-5 w-5 text-[var(--color-primary)]" />
                  </div>
                  <div className="mt-3 text-sm font-bold text-[var(--color-text)]">
                    No stubs yet
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[rgb(var(--color-text-rgb)/0.58)]">
                    Select pending payouts for a single member, create a stub,
                    then mark them paid.
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-3 rounded-2xl border border-[rgb(var(--color-border-rgb)/0.16)] bg-[rgb(var(--color-surface-rgb)/0.26)] p-3 text-xs leading-5 text-[rgb(var(--color-text-rgb)/0.58)]">
              Tip: Use filters to isolate a week or pay period before creating a
              stub.
            </div>
          </div>
        </motion.aside>
      </div>

      <AnimatePresence>
        {stubOpen ? (
          <GlobalPayoutStubModal
            payouts={selectedPayouts}
            employee={stubEmployee}
            saving={stubSaving}
            onClose={() => setStubOpen(false)}
            onConfirmPaid={markSelectedPayoutsAsPaid}
          />
        ) : null}

        {selectedStub ? (
          <PayoutStubViewerModal
            stub={selectedStub}
            employeeNameOverride={
              (selectedStubEmployee as any)?.name ||
              (selectedStub as any)?.employeeNameSnapshot ||
              undefined
            }
            onClose={() => setViewStubId(null)}
          />
        ) : null}

        {dayRateOpen && orgId ? (
          <PayTechnicianModal
            orgId={orgId}
            onClose={() => setDayRateOpen(false)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
