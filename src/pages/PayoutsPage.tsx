// src/pages/PayoutsPage.tsx
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
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
  ChevronDown,
  Download,
  FileText,
  Filter,
  MoreHorizontal,
  Pencil,
  ReceiptText,
  Search,
  Trash2,
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

function isDayRatePayout(p: PayoutDoc) {
  return getCategory(p) === "technician";
}

function formatWorkedDateLabel(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return value;

  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDayRateDisplay(p: PayoutDoc) {
  const workedDates = Array.isArray((p as any).workedDates)
    ? ((p as any).workedDates as string[]).filter(Boolean).sort()
    : [];

  const daysWorked =
    typeof (p as any).daysWorked === "number"
      ? (p as any).daysWorked
      : workedDates.length;

  const ratePerDayCents =
    typeof (p as any).ratePerDayCents === "number"
      ? (p as any).ratePerDayCents
      : null;

  const datesLabel =
    workedDates.length > 0
      ? workedDates.map(formatWorkedDateLabel).join(" • ")
      : "No worked dates saved";

  const daysLabel = `${daysWorked || 0} ${daysWorked === 1 ? "day" : "days"}`;

  const rateLabel =
    ratePerDayCents != null ? `${money(ratePerDayCents)} / day` : "";

  return {
    workedDates,
    daysWorked,
    datesLabel,
    daysLabel,
    rateLabel,
  };
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
      className="rounded-2xl  p-2 shadow-sm transition hover:bg-[var(--color-card-hover)] hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.62)]">
            {label}
          </div>
          <div className="mt-2 text-md font-poppins leading-none text-[var(--color-text)]">
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
        "inline-flex items-center rounded-full  px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
        paid
          ? "  text-[rgb(var(--pill-success-rgb))]"
          : "  text-[var(--color-primary)]"
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
        "relative inline-flex items-center justify-center rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
        active
          ? "text-[var(--color-primary)]"
          : "text-[rgb(var(--color-text-rgb)/0.62)] hover:text-[rgb(var(--color-text-rgb)/0.88)]"
      )}
    >
      {active && (
        <motion.span
          layoutId="payout-filter-active-pill"
          className="absolute inset-0 rounded-full border border-[rgb(var(--color-primary-rgb)/0.36)] bg-[rgb(var(--color-primary-rgb)/0.12)] "
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      )}

      <span className="relative z-10">{children}</span>
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
  const [open, setOpen] = useState(false);

  const options = useMemo(
    () =>
      Array.from((children as any[]).flat?.() ?? [children])
        .filter(Boolean)
        .map((child: any) => ({
          value: String(child.props.value),
          label: child.props.children,
        })),
    [children]
  );

  const selected = options.find((option) => option.value === value);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function onClick(e: MouseEvent) {
      if (!buttonRef.current?.parentElement?.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <label className="relative block min-w-0">
      <span className="sr-only">{label}</span>

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-full items-center justify-between rounded-xl border  border-[rgb(var(--color-border-rgb)/0.18)] bg-[var(--color-card-hover)] hover:bg-[var(--color-card)] px-3 text-left text-xs font-semibold text-[var(--color-text)] outline-none transition "
      >
        <span className="truncate">{selected?.label ?? label}</span>
        <ChevronDown
          className={cx(
            "h-4 w-4 shrink-0 text-[rgb(var(--color-text-rgb)/0.55)] transition",
            open && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.14, ease: EASE }}
            className="absolute left-0 top-[calc(100%+0.35rem)] z-50 max-h-60 w-full overflow-y-auto rounded-xl border border-[rgb(var(--color-border-rgb)/0.22)] bg-[var(--color-card)] p-1  section-scroll-ui"
          >
            {options.map((option) => {
              const active = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cx(
                    "flex w-full mt-1 items-center rounded-lg px-3 py-2 text-left text-xs font-semibold transition",
                    active
                      ? "bg-[rgb(var(--color-primary-rgb)/0.14)] text-[var(--color-primary)]"
                      : "text-[rgb(var(--color-text-rgb)/0.82)] hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text)]"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
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
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>("payouts");
  const [category, setCategory] = useState("all");
  const [method, setMethod] = useState("all");
  const [employeeId, setEmployeeId] = useState("all");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [viewStubId, setViewStubId] = useState<string | null>(null);
  const [dayRateOpen, setDayRateOpen] = useState(false);
  const [editingDayRatePayout, setEditingDayRatePayout] =
    useState<PayoutDoc | null>(null);
  const [deleteDayRatePayout, setDeleteDayRatePayout] =
    useState<PayoutDoc | null>(null);
  const [deletingDayRatePayout, setDeletingDayRatePayout] = useState(false);
  const [openActionsPayoutId, setOpenActionsPayoutId] = useState<string | null>(
    null
  );
  const [dismissFirstStubGuide, setDismissFirstStubGuide] = useState(false);
  const [hideStep1Guide, setHideStep1Guide] = useState(false);
  const [hideStep2Guide, setHideStep2Guide] = useState(false);
  const [stubModalGuideStep, setStubModalGuideStep] = useState<
    "print" | "markPaid" | null
  >(null);

  const selectedOneMember =
    selectedPayoutIds.length > 0 && selectedEmployeeIds.length === 1;

  const employeesById = useMemo(() => {
    const map = new Map<string, Employee>();

    employees.forEach((employee) => {
      if (employee.id) map.set(employee.id, employee);
    });

    return map;
  }, [employees]);

  function getLiveEmployeeDisplayName(p: PayoutDoc) {
    const payoutEmployeeId = (p as any).employeeId as string | undefined;
    const liveEmployee = payoutEmployeeId
      ? employeesById.get(payoutEmployeeId)
      : null;

    return (
      liveEmployee?.name?.trim() ||
      getEmployeeDisplayName(p) ||
      "Unknown member"
    );
  }

  function getLiveEmployeeNameById(
    id: string | null | undefined,
    fallback = "member"
  ) {
    if (!id) return fallback;

    return employeesById.get(id)?.name?.trim() || fallback;
  }

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
    if (
      !viewStubId &&
      !stubOpen &&
      !dayRateOpen &&
      !editingDayRatePayout &&
      !deleteDayRatePayout
    )
      return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setViewStubId(null);
        setStubOpen(false);
        setDayRateOpen(false);
        setEditingDayRatePayout(null);
        setDeleteDayRatePayout(null);
        setOpenActionsPayoutId(null);
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [
    viewStubId,
    stubOpen,
    dayRateOpen,
    editingDayRatePayout,
    deleteDayRatePayout,
    setStubOpen,
  ]);

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
          getLiveEmployeeDisplayName(p),
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
    employeesById,
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

  const shouldBlurPayoutListForStep2 = false;

  const shouldFocusFirstPayoutForStep1 =
    firstStubGuideStep === "select" && !hideStep1Guide;

  useEffect(() => {
    if (firstStubGuideStep !== "select") {
      setHideStep1Guide(false);
    }
  }, [firstStubGuideStep]);

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

  const selectedMemberId =
    selectedEmployeeIds.length === 1 ? selectedEmployeeIds[0] : null;

  const selectedHasDayRatePayout = useMemo(
    () => selectedPayouts.some(isDayRatePayout),
    [selectedPayouts]
  );

  const selectedHasJobPayout = useMemo(
    () => selectedPayouts.some((p) => !isDayRatePayout(p)),
    [selectedPayouts]
  );

  const selectedPayoutTypeConflict =
    selectedHasDayRatePayout && selectedHasJobPayout;

  const canCreateStubForSelectedPayouts =
    canCreateStub && !selectedPayoutTypeConflict;

  const selectedPayoutGroupLabel = selectedHasDayRatePayout
    ? "day-rate payouts"
    : "job payouts";

  function getPayoutSelectionBlockReason(p: PayoutDoc) {
    if (isPaid(p)) return null;

    // Already-selected payouts should always be allowed to toggle off.
    if (selectedPayoutIds.includes(p.id)) return null;

    const payoutEmployeeId = (p as any).employeeId as string | undefined;

    if (selectedMemberId && payoutEmployeeId !== selectedMemberId) {
      return "You can only create a stub for one member at a time. Clear the current selection before selecting another member.";
    }

    if (selectedHasDayRatePayout && !isDayRatePayout(p)) {
      return "Day-rate payouts need their own stub. They cannot be combined with dry-in or shingles payouts.";
    }

    if (selectedHasJobPayout && isDayRatePayout(p)) {
      return "Day-rate payouts need their own stub. Clear the selected dry-in/shingles payouts first.";
    }

    return null;
  }

  function handleTogglePayoutSelected(p: PayoutDoc) {
    const blockReason = getPayoutSelectionBlockReason(p);

    if (blockReason) {
      setSelectionError(blockReason);
      return;
    }

    setSelectionError(null);
    togglePayoutSelected(p.id);
  }

  async function confirmDeleteDayRatePayout() {
    if (!orgId || !deleteDayRatePayout?.id) return;

    setDeletingDayRatePayout(true);
    setLocalError(null);

    try {
      await deleteDoc(
        doc(db, "organizations", orgId, "payouts", deleteDayRatePayout.id)
      );

      if (selectedPayoutIds.includes(deleteDayRatePayout.id)) {
        togglePayoutSelected(deleteDayRatePayout.id);
      }

      setDeleteDayRatePayout(null);
      setOpenActionsPayoutId(null);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    } finally {
      setDeletingDayRatePayout(false);
    }
  }

  const selectedMemberName = useMemo(() => {
    if (!selectedMemberId) return "";

    const liveName = getLiveEmployeeNameById(selectedMemberId, "");
    if (liveName) return liveName;

    const selectedPayout = selectedPayouts.find(
      (p) => (p as any).employeeId === selectedMemberId
    );

    return selectedPayout
      ? getLiveEmployeeDisplayName(selectedPayout)
      : "member";
  }, [selectedMemberId, selectedPayouts, employeesById]);

  const selectablePayoutsForSelectedMember = useMemo(() => {
    if (!selectedMemberId) return [];

    return filtered.filter((p) => {
      if (isPaid(p)) return false;
      if ((p as any).employeeId !== selectedMemberId) return false;
      if (selectedPayoutIds.includes(p.id)) return false;

      // Once the user starts a day-rate stub, only add other day-rate payouts.
      if (selectedHasDayRatePayout) return isDayRatePayout(p);

      // Once the user starts a job-work stub, only add dry-in/shingles payouts.
      if (selectedHasJobPayout) return !isDayRatePayout(p);

      return true;
    });
  }, [
    filtered,
    selectedMemberId,
    selectedPayoutIds,
    selectedHasDayRatePayout,
    selectedHasJobPayout,
  ]);

  function selectAllForSelectedMember() {
    selectablePayoutsForSelectedMember.forEach((p) => {
      togglePayoutSelected(p.id);
    });

    setSelectionError(null);

    // Hide only the Step 2 tooltip. Keep the tutorial alive for steps 3 and 4.
    setHideStep2Guide(true);
  }

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
      employee: getLiveEmployeeDisplayName(p),
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
    <div className="mx-auto w-[min(1450px,94vw)] bg-gradient-to-b from-[var(--color-background)] to-[var(--color-card)]">
      <motion.header {...fadeUp(0)} className="mb-3">
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
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[rgb(var(--color-primary-rgb)/0.28)] bg-[rgb(var(--color-primary-rgb)/0.05)] px-4 py-2 text-sm font-bold text-[var(--color-text)] cursor-pointer shadow-sm transition hover:bg-[rgb(var(--color-primary-rgb)/0.18)] hover:shadow-md"
            >
              <Users className="h-4 w-4" />
              Day-rate payout
            </button>

            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center cursor-pointer justify-center gap-2 rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-4 py-2 text-sm font-semibold text-[rgb(var(--color-text-rgb)/0.82)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.76)] hover:text-[var(--color-text)]"
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

      <div className="mt-5 grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:h-[calc(100vh-7.5rem)] xl:min-h-[720px] mb-0">
        <motion.section
          {...fadeUp(0.05)}
          className={cx(
            "min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm",
            mobileView !== "payouts" ? "hidden md:flex" : "flex"
          )}
        >
          <div
            ref={listTopRef}
            className="border-b border-[var(--color-border)] bg-[rgb(var(--color-surface-rgb)/0.18)] p-4"
          >
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="inline-flex flex-wrap items-center gap-1  p-1">
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
                  className="h-10 w-full rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[var(--color-card-hover)] pl-10 pr-3 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[rgb(var(--color-text-rgb)/0.36)] hover:bg-[var(--color-card)] focus:border-[rgb(var(--color-primary-rgb)/0.42)] focus:ring-2 focus:ring-[rgb(var(--color-primary-rgb)/0.12)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  type="date"
                  className="h-10 min-w-0 rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[var(--color-card-hover)] px-3 text-xs font-semibold text-[var(--color-text)] outline-none transition hover:bg-[var(--color-card)] focus:border-[rgb(var(--color-primary-rgb)/0.42)] focus:ring-2 focus:ring-[rgb(var(--color-primary-rgb)/0.12)]"
                />
                <input
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  type="date"
                  className="h-10 min-w-0 rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[var(--color-card-hover)] px-3 text-xs font-semibold text-[var(--color-text)] outline-none transition hover:bg-[var(--color-card)] focus:border-[rgb(var(--color-primary-rgb)/0.42)] focus:ring-2 focus:ring-[rgb(var(--color-primary-rgb)/0.12)]"
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
                    className=" bg-[var(--color-surface)] text-[var(--color-text)]"
                  >
                    Member
                  </option>
                  {employees.map((employee) => (
                    <option
                      key={employee.id}
                      value={employee.id}
                      className="bg-[var(--color-card)] text-[var(--color-text)]"
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
                      className="bg-[var(--color-card)] text-[var(--color-text)]"
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

          <div
            className={cx(
              "min-h-0 flex-1 overflow-y-auto p-4 payouts-table-scroll transition duration-300",
              shouldBlurPayoutListForStep2 &&
                "blur-[2px] opacity-55 pointer-events-none select-none"
            )}
          >
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

                  const showSelectGuideCallout =
                    showSelectGuide && !hideStep1Guide;

                  const shouldBlurThisRowForStep1 =
                    shouldFocusFirstPayoutForStep1 && !showSelectGuide;
                  return (
                    <motion.div
                      key={
                        p.id ||
                        `${(p as any).employeeId}-${
                          (p as any).createdAt?.seconds ?? Math.random()
                        }`
                      }
                      transition={{ duration: 0.18, ease: EASE }}
                      className={cx(
                        "relative grid gap-3 px-4 py-2 transition duration-300 md:grid-cols-[minmax(0,1fr)_auto] md:items-center",
                        selected
                          ? "bg-[var(--color-card-hover)]/70"
                          : "hover:bg-[var(--color-card-hover)]",
                        showSelectGuide &&
                          "z-30 bg-[rgb(var(--color-primary-rgb)/0.07)] ring-1 ring-[rgb(var(--color-primary-rgb)/0.24)] shadow-[0_18px_70px_rgba(0,0,0,0.28)]",
                        shouldBlurThisRowForStep1 &&
                          "blur-[2px] opacity-45 pointer-events-none select-none"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-sm font-extrabold text-[var(--color-text)]">
                            {getLiveEmployeeDisplayName(p)}
                          </div>
                          <StatusPill paid={paid} />
                          <span className="rounded-full   px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.72)]">
                            {categoryLabel(getCategory(p))}
                          </span>
                          <span className="rounded-full  px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.72)]">
                            {methodLabel(getMethod(p))}
                          </span>
                        </div>

                        {isDayRatePayout(p) ? (
                          <div className="mt-2 text-sm text-[rgb(var(--color-text-rgb)/0.82)]">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-[var(--color-text)]">
                                {getDayRateDisplay(p).datesLabel}
                              </span>

                              <span className="rounded-full border border-[rgb(var(--color-primary-rgb)/0.22)] bg-[rgb(var(--color-primary-rgb)/0.10)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-primary)]">
                                {getDayRateDisplay(p).daysLabel}
                              </span>
                            </div>

                            {getDayRateDisplay(p).rateLabel ? (
                              <div className="mt-1 text-xs text-[rgb(var(--color-text-rgb)/0.58)]">
                                {getDayRateDisplay(p).rateLabel}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="mt-2 truncate text-sm text-[rgb(var(--color-text-rgb)/0.82)]">
                            {getJobAddress(p) || "No job address saved"}
                          </div>
                        )}

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
                              {(p as any).sqft} SQ x $
                              {Number((p as any).ratePerSqFt).toFixed(2)} / SQ
                            </span>
                          ) : null}
                          {isDayRatePayout(p) &&
                          getDayRateDisplay(p).rateLabel ? (
                            <span>{getDayRateDisplay(p).rateLabel}</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 md:flex-col md:items-end">
                        <div className="rounded-xl  px-3 py-2 text-right">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.52)]">
                            Amount
                          </div>
                          <div className="text-base font-semibold text-[var(--color-text)]">
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

                          {isDayRatePayout(p) ? (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenActionsPayoutId((current) =>
                                    current === p.id ? null : p.id
                                  )
                                }
                                className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.45)] px-3 py-2 text-xs font-bold text-[rgb(var(--color-text-rgb)/0.78)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.72)] hover:text-[var(--color-text)]"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                Actions
                              </button>

                              <AnimatePresence>
                                {openActionsPayoutId === p.id ? (
                                  <motion.div
                                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                                    transition={{ duration: 0.16, ease: EASE }}
                                    className="absolute right-0 top-[calc(100%+0.45rem)] z-50 w-56 overflow-hidden rounded-2xl border border-[rgb(var(--color-border-rgb)/0.22)] bg-[var(--color-card)] p-1 shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
                                  >
                                    {!paid ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingDayRatePayout(p);
                                            setOpenActionsPayoutId(null);
                                          }}
                                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-[rgb(var(--color-text-rgb)/0.86)] transition hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text)]"
                                        >
                                          <Pencil className="h-4 w-4" />
                                          Edit payout
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            setDeleteDayRatePayout(p);
                                            setOpenActionsPayoutId(null);
                                          }}
                                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-red-300 transition hover:bg-red-500/10 hover:text-red-200"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                          Delete payout
                                        </button>
                                      </>
                                    ) : (
                                      <div className="rounded-xl px-3 py-2">
                                        <div className="text-xs font-bold text-[var(--color-text)]">
                                          Void / Correction
                                        </div>
                                        <p className="mt-1 text-[11px] leading-4 text-[rgb(var(--color-text-rgb)/0.58)]">
                                          Paid stubs are locked. A correction
                                          workflow can be added next.
                                        </p>
                                      </div>
                                    )}
                                  </motion.div>
                                ) : null}
                              </AnimatePresence>
                            </div>
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
                              onClick={() => handleTogglePayoutSelected(p)}
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

                            {showSelectGuideCallout ? (
                              <motion.div
                                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                                transition={{ duration: 0.2, ease: EASE }}
                                className="absolute right-0 top-full z-50 mt-3 w-[320px] rounded-2xl border border-[rgb(var(--color-primary-rgb)/0.28)] bg-[var(--color-card)] p-4 text-left shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
                              >
                                <div className="flex items-start gap-3">
                                  <div className="min-w-0">
                                    <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-primary)]">
                                      Step 1 of 4
                                    </div>

                                    <div className="mt-1 text-sm font-extrabold text-[var(--color-text)]">
                                      Create your first pay stub
                                    </div>

                                    <p className="mt-1 text-xs leading-5 text-[rgb(var(--color-text-rgb)/0.64)]">
                                      Select one or more pending payouts for the
                                      same member. RoofZeus will group them into
                                      a clean pay stub so you can review the
                                      payment, print or save the stub, and then
                                      mark those payouts as paid.
                                    </p>

                                    <button
                                      type="button"
                                      onClick={() => setHideStep1Guide(true)}
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

          <div
            className={cx(
              "sticky bottom-0 z-20 border-t border-[var(--color-border)] bg-[rgb(var(--color-surface-rgb)/0.18)] backdrop-blur-xl",
              firstStubGuideStep === "create" && "z-50"
            )}
          >
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
                      selected{" "}
                      <span className="text-[var(--color-text)]/30">|</span>{" "}
                      <span className="text-[var(--color-text)]">
                        {" "}
                        {money(selectedTotalCents)}
                      </span>{" "}
                      <span className="text-[var(--color-text)]/70">total</span>
                      {selectedPayoutIds.length > 0 ? (
                        <span className="mt-1 flex items-center gap-1 text-[rgb(var(--color-text-rgb)/0.56)] sm:mt-0 sm:inline-flex sm:pl-2">
                          {selectedPayoutGroupLabel}
                        </span>
                      ) : null}
                      {selectedEmployeeIds.length > 1 ? (
                        <span className="mt-1 flex items-center gap-1 text-amber-300/85 sm:mt-0 sm:inline-flex sm:pl-2">
                          <AlertTriangle className="h-4 w-4" /> Select one
                          member only to create a stub.
                        </span>
                      ) : null}
                      {selectedPayoutTypeConflict ? (
                        <span className="mt-1 flex items-center gap-1 text-amber-300/85 sm:mt-0 sm:inline-flex sm:pl-2">
                          <AlertTriangle className="h-4 w-4" /> Day-rate payouts
                          cannot be combined with dry-in/shingles payouts.
                        </span>
                      ) : null}
                      {selectionError ? (
                        <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-200">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{selectionError}</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedOneMember &&
                      selectablePayoutsForSelectedMember.length > 0 ? (
                        <button
                          type="button"
                          onClick={selectAllForSelectedMember}
                          className="inline-flex items-center cursor-pointer gap-2 rounded-xl border border-[rgb(var(--color-primary-rgb)/0.28)] bg-[rgb(var(--color-primary-rgb)/0.05)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[rgb(var(--color-primary-rgb)/0.16)]"
                        >
                          <Users className="h-4 w-4" />
                          Select all {selectedPayoutGroupLabel} for{" "}
                          {selectedMemberName}
                          <span className="rounded-full bg-[rgb(var(--color-primary-rgb)/0.14)] px-2 py-0.5 text-[11px]">
                            +{selectablePayoutsForSelectedMember.length}
                          </span>
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => {
                          clearSelectedPayouts();
                          setHideStep2Guide(false);
                          setSelectionError(null);
                        }}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-red-400/28 bg-red-400/5 px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:bg-red-400/16"
                      >
                        <X className="h-4 w-4 text-red-300" />
                        Clear
                      </button>
                      <div
                        className={cx(
                          "relative",
                          firstStubGuideStep === "create" && "z-50"
                        )}
                      >
                        <button
                          type="button"
                          disabled={!canCreateStubForSelectedPayouts}
                          onClick={() => {
                            if (!canCreateStubForSelectedPayouts) {
                              setSelectionError(
                                selectedPayoutTypeConflict
                                  ? "Day-rate payouts cannot be combined with dry-in/shingles payouts."
                                  : "Select pending payouts for one member before creating a stub."
                              );
                              return;
                            }

                            setSelectionError(null);
                            setStubModalGuideStep("print");
                            setStubOpen(true);
                          }}
                          className="relative inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[rgb(var(--pill-success-rgb)/0.28)] bg-[rgb(var(--pill-success-rgb)/0.05)] px-4 py-2 text-sm font-bold text-[var(--color-text)] transition hover:bg-[rgb(var(--pill-success-rgb)/0.16)] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <FileText className="h-4 w-4 text-[rgb(var(--pill-success-rgb))]" />
                          Create stub
                        </button>

                        {firstStubGuideStep === "create" && !hideStep2Guide ? (
                          <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.98 }}
                            transition={{ duration: 0.2, ease: EASE }}
                            className="absolute bottom-full right-0 z-50 mb-3 w-[320px] rounded-2xl border border-[rgb(var(--pill-success-rgb)/0.30)] bg-[var(--color-card)] p-4 text-left "
                          >
                            <div className="text-[11px] font-bold uppercase tracking-wide text-[rgb(var(--pill-success-rgb))]">
                              Step 2 of 4
                            </div>
                            <div className="mt-1 text-sm font-extrabold text-[var(--color-text)]">
                              Review your selected payouts
                            </div>

                            <p className="mt-1 text-xs leading-5 text-[rgb(var(--color-text-rgb)/0.64)]">
                              Add any other pending payouts for this same member
                              before creating the stub. When everything looks
                              right, click{" "}
                              <span className="font-bold text-[rgb(var(--pill-success-rgb))]">
                                Create stub
                              </span>
                              .
                            </p>

                            <div className="mt-3 rounded-xl border border-[rgb(var(--color-border-rgb)/0.16)] bg-[rgb(var(--color-surface-rgb)/0.35)] px-3 py-2 text-[11px] leading-4 text-[rgb(var(--color-text-rgb)/0.58)]">
                              Tip: select multiple payouts now so they print
                              together on one clean pay stub.
                            </div>

                            <button
                              type="button"
                              onClick={() => setHideStep2Guide(true)}
                              className="mt-3 text-[11px] font-semibold text-[rgb(var(--color-text-rgb)/0.58)] hover:text-[var(--color-text)]"
                            >
                              Keep selecting
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
                  className={[
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-xl border",
                    "border-[rgb(var(--color-border-rgb)/0.28)] bg-[rgb(var(--color-text-rgb)/0.05)]",
                    "px-2 py-1 text-sm font-bold text-[var(--color-text)] transition",
                    "hover:border-[rgb(var(--color-border-rgb)/0.42)] hover:bg-[rgb(var(--color-text-rgb)/0.10)]",
                    "disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-[rgb(var(--color-border-rgb)/0.28)] disabled:hover:bg-[rgb(var(--color-text-rgb)/0.05)]",
                  ].join(" ")}
                >
                  <ChevronLeft className="h-4 w-4 text-[rgb(var(--color-text-rgb)/0.68)]" />
                  Prev
                </button>

                <div
                  className={[
                    "inline-flex items-center justify-center rounded-xl",
                    "",
                    "px-2 py-1 text-sm text-[var(--color-text)]",
                  ].join(" ")}
                >
                  Page{" "}
                  <span className="mx-1 text-[var(--color-text)]">
                    {pageSafe}
                  </span>
                  <span className="text-[rgb(var(--color-text-rgb)/0.55)]">
                    / {pageCount}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={pageSafe >= pageCount}
                  onClick={() =>
                    setPayoutsPage((p) => Math.min(pageCount, p + 1))
                  }
                  className={[
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-xl border",
                    "border-[rgb(var(--color-border-rgb)/0.28)] bg-[rgb(var(--color-text-rgb)/0.05)]",
                    "px-2 py-1 text-sm font-bold text-[var(--color-text)] transition",
                    "hover:border-[rgb(var(--color-border-rgb)/0.42)] hover:bg-[rgb(var(--color-text-rgb)/0.10)]",
                    "disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-[rgb(var(--color-border-rgb)/0.28)] disabled:hover:bg-[rgb(var(--color-text-rgb)/0.05)]",
                  ].join(" ")}
                >
                  Next
                  <ChevronRight className="h-4 w-4 text-[rgb(var(--color-text-rgb)/0.68)]" />
                </button>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.aside
          {...fadeUp(0.08)}
          className={cx(
            "min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm",
            mobileView !== "stubs" ? "hidden md:flex" : "flex"
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

          <div className="min-h-0 flex-1 overflow-y-auto p-4 payouts-table-scroll">
            <div className="divide-y divide-[rgb(var(--color-border-rgb)/0.16)]">
              {stubs.slice(0, 18).map((stub) => (
                <button
                  key={stub.id}
                  type="button"
                  onClick={() => setViewStubId(stub.id)}
                  className="w-full  p-3 text-left transition hover:bg-[var(--color-card-hover)] hover:shadow-sm"
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
                          {getLiveEmployeeNameById(
                            (stub as any).employeeId,
                            (stub as any).employeeNameSnapshot || "Member"
                          )}
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
                <div className="rounded-2xl   p-6 text-center">
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
          </div>
        </motion.aside>
      </div>

      <AnimatePresence>
        {stubOpen ? (
          <GlobalPayoutStubModal
            payouts={selectedPayouts}
            employee={stubEmployee}
            saving={stubSaving}
            firstStubGuideStep={
              showFirstPaystubGuide ? stubModalGuideStep : null
            }
            onFirstStubGuideStepChange={setStubModalGuideStep}
            onDismissFirstStubGuide={() => {
              setDismissFirstStubGuide(true);
              setStubModalGuideStep(null);
            }}
            onClose={() => setStubOpen(false)}
            onConfirmPaid={async () => {
              await markSelectedPayoutsAsPaid();
              setDismissFirstStubGuide(true);
              setStubModalGuideStep(null);
            }}
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
            existingDayRatePayouts={payouts.filter(isDayRatePayout)}
            onClose={() => setDayRateOpen(false)}
          />
        ) : null}

        {editingDayRatePayout && orgId ? (
          <PayTechnicianModal
            orgId={orgId}
            editPayout={editingDayRatePayout}
            existingDayRatePayouts={payouts.filter(isDayRatePayout)}
            onClose={() => setEditingDayRatePayout(null)}
          />
        ) : null}

        {deleteDayRatePayout ? (
          <motion.div
            className="fixed inset-0 z-[90] grid place-items-center bg-black/65 px-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              {...fadeUp(0)}
              className="w-full max-w-md overflow-hidden rounded-2xl border border-[rgb(var(--color-border-rgb)/0.22)] bg-[var(--color-card)] shadow-[0_28px_90px_rgba(0,0,0,0.65)]"
            >
              <div className="border-b border-[rgb(var(--color-border-rgb)/0.18)] px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-red-400/25 bg-red-400/10 text-red-300">
                    <Trash2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[var(--color-text)]">
                      Delete day-rate payout?
                    </h3>
                    <p className="mt-1 text-sm leading-5 text-[rgb(var(--color-text-rgb)/0.64)]">
                      This only deletes the pending payout for{" "}
                      {getLiveEmployeeDisplayName(deleteDayRatePayout)}. Paid or
                      stubbed payouts should use a correction workflow instead.
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 text-sm text-[rgb(var(--color-text-rgb)/0.72)]">
                <div className="rounded-2xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.35)] p-3">
                  <div className="font-semibold text-[var(--color-text)]">
                    {getDayRateDisplay(deleteDayRatePayout).datesLabel}
                  </div>
                  <div className="mt-1 text-xs">
                    {money((deleteDayRatePayout as any).amountCents)} •{" "}
                    {getDayRateDisplay(deleteDayRatePayout).rateLabel ||
                      "Day rate"}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[rgb(var(--color-border-rgb)/0.18)] px-5 py-4">
                <button
                  type="button"
                  onClick={() => setDeleteDayRatePayout(null)}
                  disabled={deletingDayRatePayout}
                  className="rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.45)] px-4 py-2 text-xs font-bold text-[rgb(var(--color-text-rgb)/0.78)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.72)] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteDayRatePayout}
                  disabled={deletingDayRatePayout}
                  className="rounded-xl border border-red-400/25 bg-red-500/15 px-4 py-2 text-xs font-bold text-red-200 transition hover:bg-red-500/25 disabled:opacity-50"
                >
                  {deletingDayRatePayout ? "Deleting…" : "Delete payout"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
