import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type { FieldValue } from "firebase/firestore";
import {
  X,
  Wrench,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { AnimatePresence, motion, type MotionProps } from "framer-motion";
import { db } from "../firebase/firebaseConfig";
import type { Employee, PayoutDoc } from "../types/types";

/**
 * PayTechnicianModal
 * - Creates a GLOBAL payout doc (no job association) in `payouts`
 * - category: "technician"
 * - amountCents derived from daysWorked * ratePerDayCents
 *
 * Usage:
 * {techPayOpen && (
 *   <PayTechnicianModal
 *     onClose={() => setTechPayOpen(false)}
 *     defaultEmployeeId={employee?.id}
 *     lockEmployee={true}
 *     onCreated={() => toast("Technician payout created")}
 *   />
 * )}
 */

export type PayTechnicianModalProps = {
  onClose: () => void;

  orgId: string;
  /** Optional: preselect an employee (useful on EmployeeDetailPage) */
  defaultEmployeeId?: string;

  /** If true, employee select is disabled (useful when launching from an employee page) */
  lockEmployee?: boolean;

  /** Optional callback after successful creation */
  onCreated?: (created: PayoutDoc) => void;

  /** Optional: default day rate (USD) */
  defaultRatePerDay?: number;

  /** Optional: default method */
  defaultMethod?: "cash" | "check" | "zelle" | "other";

  /** Existing payouts used to prevent duplicate day-rate dates for the same member */
  existingDayRatePayouts?: PayoutDoc[];

  /** Existing pending day-rate payout to edit */
  editPayout?: PayoutDoc | null;
};

function money(cents: number | null | undefined): string {
  const v = typeof cents === "number" ? cents : 0;
  return (v / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function toCents(x: number): number {
  return Math.round(x * 100);
}

// ---- Motion helpers (match your dashboard vibe) ----
const EASE = [0.16, 1, 0.3, 1] as const;

const fadeUp = (delay = 0): MotionProps => ({
  initial: { opacity: 0, y: 12, filter: "blur(8px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: 10, filter: "blur(8px)" },
  transition: { duration: 0.55, ease: EASE, delay },
});

const softFade: MotionProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.25, ease: EASE },
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function isPaidPayout(p: PayoutDoc) {
  return Boolean((p as any).paidAt);
}

function payoutStubLabel(p: PayoutDoc) {
  return (
    (p as any).paidStubNumber ||
    (p as any).payoutStubId ||
    (p as any).stubId ||
    "stubbed"
  );
}

function SelectShell({
  value,
  onChange,
  children,
  label,
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  className?: string;
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
    <label className={cx("relative z-[80] block min-w-0", className)}>
      <span className="sr-only">{label}</span>

      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className="flex h-10 w-full items-center justify-between rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[var(--color-card-hover)] hover:bg-[var(--color-card)] px-3 text-left text-xs font-semibold text-[var(--color-text)] outline-none transition disabled:cursor-not-allowed disabled:opacity-60"
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
        {open && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.14, ease: EASE }}
            className="absolute left-0 top-[calc(100%+0.35rem)] z-[999] max-h-60 w-full overflow-y-auto rounded-xl border border-[rgb(var(--color-border-rgb)/0.22)] bg-[var(--color-card)] p-1 shadow-[0_18px_45px_rgba(0,0,0,0.45)] section-scroll"
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
                    "mt-1 flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-semibold transition",
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

function MultiDatePicker({
  selectedDates,
  onChange,
  disabled,
  inputBase,
  formatWorkDate,
  onOpenChange,
  blockedDates = {},
}: {
  selectedDates: string[];
  onChange: (dates: string[]) => void;
  disabled?: boolean;
  inputBase: string;
  formatWorkDate: (ymd: string) => string;
  onOpenChange?: (open: boolean) => void;
  blockedDates?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [draftDates, setDraftDates] = useState<string[]>(selectedDates);
  const [viewDate, setViewDate] = useState(() => new Date());

  useEffect(() => {
    if (open) setDraftDates(selectedDates);
    onOpenChange?.(open);
  }, [open, selectedDates, onOpenChange]);

  function toYmd(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthLabel = viewDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<{ date: Date; inMonth: boolean; ymd: string }> = [];

    for (let i = 0; i < startDay; i++) {
      const d = new Date(year, month, i - startDay + 1);
      cells.push({ date: d, inMonth: false, ymd: toYmd(d) });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      cells.push({ date: d, inMonth: true, ymd: toYmd(d) });
    }

    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      const d = new Date(last);
      d.setDate(last.getDate() + 1);
      cells.push({ date: d, inMonth: false, ymd: toYmd(d) });
    }

    return cells;
  }, [year, month]);

  function toggleDate(ymd: string) {
    if (blockedDates[ymd]) return;

    setDraftDates((prev) =>
      prev.includes(ymd) ? prev.filter((d) => d !== ymd) : [...prev, ymd].sort()
    );
  }

  function goMonth(direction: -1 | 1) {
    setViewDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1)
    );
  }

  function done() {
    onChange([...draftDates].sort());
    setOpen(false);
  }

  const summary =
    selectedDates.length === 0
      ? "Select worked dates"
      : selectedDates.length === 1
      ? formatWorkDate(selectedDates[0])
      : `${selectedDates.length} dates selected`;

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`${inputBase} flex items-center justify-between text-left`}
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-[var(--color-text)]/45" />
          <span className="truncate">{summary}</span>
        </span>

        <ChevronDown
          className={cx(
            "h-4 w-4 shrink-0 text-[var(--color-text)]/55 transition",
            open && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {open && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.16, ease: EASE }}
            className="absolute left-0 top-[calc(100%+0.45rem)] z-[999] w-[320px] overflow-hidden rounded-2xl border border-[rgb(var(--color-border-rgb)/0.22)] bg-[var(--color-card)] shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-3">
              <button
                type="button"
                onClick={() => goMonth(-1)}
                className="rounded-lg p-2 text-[var(--color-text)]/70 transition hover:bg-white/10 hover:text-[var(--color-text)]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="text-sm font-semibold text-[var(--color-text)]">
                {monthLabel}
              </div>

              <button
                type="button"
                onClick={() => goMonth(1)}
                className="rounded-lg p-2 text-[var(--color-text)]/70 transition hover:bg-white/10 hover:text-[var(--color-text)]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 px-3 pt-3 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text)]/45">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 p-3">
              {calendarDays.map(({ ymd, date, inMonth }) => {
                const selected = draftDates.includes(ymd);
                const blockedReason = blockedDates[ymd];
                const blocked = Boolean(blockedReason);

                return (
                  <button
                    key={ymd}
                    type="button"
                    disabled={blocked}
                    title={blockedReason || undefined}
                    onClick={() => toggleDate(ymd)}
                    className={cx(
                      "relative grid h-9 place-items-center rounded-xl text-xs font-semibold transition",
                      inMonth
                        ? "text-[var(--color-text)]"
                        : "text-[var(--color-text)]/30",
                      blocked &&
                        "cursor-not-allowed border border-amber-300/25 bg-amber-300/10 text-amber-200/60 line-through opacity-70",
                      selected && !blocked
                        ? "bg-[var(--btn-bg)] text-[var(--btn-text)] ring-2 ring-[var(--color-accent-gold)]/70 shadow-[0_0_0_4px_rgb(var(--color-primary-rgb)/0.18)]"
                        : !blocked && "hover:bg-[var(--color-card-hover)]"
                    )}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 py-3">
              <button
                type="button"
                onClick={() => setDraftDates([])}
                className="rounded-xl px-3 py-2 text-xs font-semibold text-[var(--color-text)]/60 transition hover:bg-white/10 hover:text-[var(--color-text)]"
              >
                Clear
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-[var(--color-text)]/70 transition hover:bg-white/10"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={done}
                  className="rounded-xl bg-[var(--color-card-hover)] px-3 py-2 text-xs font-semibold text-[var(--color-text)]/70 hover:text-[var(--color-text)] transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PayTechnicianModal({
  onClose,
  defaultEmployeeId,
  lockEmployee,
  orgId,
  onCreated,
  defaultRatePerDay,
  defaultMethod = "check",
  existingDayRatePayouts = [],
  editPayout = null,
}: PayTechnicianModalProps) {
  if (typeof document === "undefined") return null;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [employeesError, setEmployeesError] = useState<string | null>(null);

  const isEditing = Boolean(editPayout?.id);

  const [employeeId, setEmployeeId] = useState(
    ((editPayout as any)?.employeeId as string | undefined) ??
      defaultEmployeeId ??
      ""
  );
  const [workedDates, setWorkedDates] = useState<string[]>(() =>
    Array.isArray((editPayout as any)?.workedDates)
      ? [...((editPayout as any).workedDates as string[])]
          .filter(Boolean)
          .sort()
      : []
  );
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [ratePerDay, setRatePerDay] = useState<string>(() => {
    const editRateCents = (editPayout as any)?.ratePerDayCents;
    if (typeof editRateCents === "number") return String(editRateCents / 100);
    return typeof defaultRatePerDay === "number"
      ? String(defaultRatePerDay)
      : "";
  });
  const [method, setMethod] = useState<"cash" | "check" | "zelle" | "other">(
    ((editPayout as any)?.method as
      | "cash"
      | "check"
      | "zelle"
      | "other"
      | undefined) ?? defaultMethod
  );
  const [note, setNote] = useState<string>(
    ((editPayout as any)?.note as string | undefined) ??
      ((editPayout as any)?.memo as string | undefined) ??
      ""
  );

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load employees from the active organization
  useEffect(() => {
    if (!orgId) {
      setEmployees([]);
      setLoadingEmployees(false);
      return;
    }

    setLoadingEmployees(true);
    setEmployeesError(null);

    const employeesRef = collection(db, "organizations", orgId, "employees");
    const employeesQuery = query(employeesRef, orderBy("name", "asc"));

    const unsub = onSnapshot(
      employeesQuery,
      (snap) => {
        const list: Employee[] = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Employee, "id">),
          }))
          .filter((employee) => employee.isActive !== false);

        setEmployees(list);

        if (!isEditing && !defaultEmployeeId && list.length > 0) {
          setEmployeeId((prev) => prev || list[0].id);
        }

        if (
          !isEditing &&
          defaultEmployeeId &&
          list.some((e) => e.id === defaultEmployeeId)
        ) {
          setEmployeeId(defaultEmployeeId);
        }

        setLoadingEmployees(false);
      },
      (e) => {
        console.error("Failed to load employees for day-rate payout:", e);
        setEmployees([]);
        setEmployeesError(e instanceof Error ? e.message : String(e));
        setLoadingEmployees(false);
      }
    );

    return () => unsub();
  }, [orgId, defaultEmployeeId, isEditing]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === employeeId) ?? null,
    [employees, employeeId]
  );
  function formatWorkDate(ymd: string) {
    const [year, month, day] = ymd.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    if (Number.isNaN(date.getTime())) return ymd;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function removeWorkedDate(date: string) {
    setWorkedDates((prev) => prev.filter((d) => d !== date));
  }

  const daysNum = useMemo(() => workedDates.length, [workedDates]);
  const rateNum = useMemo(() => Number(ratePerDay), [ratePerDay]);

  const totalCents = useMemo(() => {
    if (!Number.isFinite(daysNum) || !Number.isFinite(rateNum)) return 0;
    if (daysNum <= 0 || rateNum <= 0) return 0;
    return Math.round(daysNum * toCents(rateNum));
  }, [daysNum, rateNum]);

  const blockedDates = useMemo(() => {
    if (!employeeId) return {} as Record<string, string>;

    const map: Record<string, string> = {};

    existingDayRatePayouts.forEach((p) => {
      if (editPayout?.id && p.id === editPayout.id) return;
      if ((p as any).employeeId !== employeeId) return;
      if ((p as any).category !== "technician") return;

      const dates = Array.isArray((p as any).workedDates)
        ? ((p as any).workedDates as string[])
        : [];

      dates.forEach((date) => {
        if (!date) return;

        const status = isPaidPayout(p)
          ? `already paid on ${payoutStubLabel(p)}`
          : "already exists as a pending day-rate payout";

        map[date] = `${formatWorkDate(date)} ${status}.`;
      });
    });

    return map;
  }, [employeeId, existingDayRatePayouts, editPayout?.id]);

  const blockedSelectedDates = useMemo(
    () => workedDates.filter((date) => blockedDates[date]),
    [workedDates, blockedDates]
  );

  useEffect(() => {
    setWorkedDates((prev) => prev.filter((date) => !blockedDates[date]));
  }, [blockedDates]);

  async function submit() {
    setFormError(null);

    if (!employeeId) {
      setFormError("Please select an employee.");
      return;
    }
    if (!selectedEmployee) {
      setFormError("Selected employee not found.");
      return;
    }
    if (workedDates.length <= 0) {
      setFormError("Select at least one worked date.");
      return;
    }
    if (!Number.isFinite(rateNum) || rateNum <= 0) {
      setFormError("Enter rate per day (must be greater than 0).");
      return;
    }
    if (blockedSelectedDates.length > 0) {
      setFormError(
        `Remove duplicate date${
          blockedSelectedDates.length === 1 ? "" : "s"
        }: ${blockedSelectedDates.map(formatWorkDate).join(", ")}.`
      );
      return;
    }
    if (!orgId) {
      setFormError("Org not loaded. Please refresh and try again.");
      return;
    }

    const ratePerDayCents = toCents(rateNum);
    const amountCents = Math.round(daysNum * ratePerDayCents);

    setSaving(true);
    try {
      const payoutRef = editPayout?.id
        ? doc(db, "organizations", orgId, "payouts", editPayout.id)
        : doc(collection(db, "organizations", orgId, "payouts"));

      // NOTE: keep the doc minimal + compatible with your existing dashboard renders.
      // This is typed as a Firestore patch because edit mode intentionally preserves createdAt.
      const docData: Partial<Omit<PayoutDoc, "id">> & {
        id: string;
        orgId: string;
        employeeId: string;
        employeeNameSnapshot: string;
        category: "technician";
        amountCents: number;
        method: "cash" | "check" | "zelle" | "other";
        daysWorked: number;
        workedDates: string[];
        ratePerDayCents: number;
        note?: string;
        memo?: string;
        createdAt?: FieldValue;
        updatedAt?: FieldValue;
        paidAt?: null;
      } = {
        id: payoutRef.id,
        orgId,
        employeeId,
        employeeNameSnapshot:
          selectedEmployee.name || selectedEmployee.email || "Unnamed employee",

        category: "technician",
        amountCents,

        // breakdown fields
        daysWorked: workedDates.length,
        workedDates,
        ratePerDayCents,

        method,

        ...(note.trim().length ? { note: note.trim(), memo: note.trim() } : {}),

        ...(editPayout?.id
          ? { updatedAt: serverTimestamp() as unknown as FieldValue }
          : { createdAt: serverTimestamp() as unknown as FieldValue }),

        // unpaid by default. Do not overwrite paidAt when editing.
        ...(editPayout?.id ? {} : { paidAt: null as any }),
      };

      await setDoc(payoutRef, docData as any, { merge: true });

      const created: PayoutDoc = {
        id: payoutRef.id,
        ...(docData as any),
      };

      onCreated?.(created);
      onClose();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  // Close on ESC
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const inputBase =
    "mt-1 w-full rounded-xl border border-[rgb(var(--color-border-rgb)/0.14)] bg-[var(--color-card-hover)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent-gold)]/35 focus:bg-[var(--color-card)] hover:bg-[var(--color-card)] disabled:opacity-60";

  const content = (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-3"
        {...softFade}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" />

        {/* Click-away overlay */}
        <button
          type="button"
          onClick={onClose}
          className="absolute inset-0 cursor-default"
          aria-label="Close"
        />

        {/* Modal */}
        <motion.div
          {...fadeUp(0.02)}
          className={cx(
            "relative z-10 w-full max-w-xl overflow-visible rounded-2xl border",
            "bg-[var(--color-card)] backdrop-blur",
            "shadow-[0_30px_90px_rgba(0,0,0,0.65)]"
          )}
          style={{ borderColor: "var(--color-border)" }}
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <motion.div
            {...fadeUp(0.04)}
            className="relative flex items-start justify-between gap-4 border-b border-[rgb(var(--color-border-rgb)/0.14)] px-6 py-5"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgb(var(--color-border-rgb)/0.14)] bg-white/5 text-[var(--color-accent-gold)]">
                <Wrench className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-[var(--color-text)] tracking-wide">
                  Create day-rate payout
                </h2>
                <p className="mt-1 text-xs text-[var(--color-text)]/70">
                  For inspections, service calls, punch supervision, or any
                  non-job-tied work.
                </p>
              </div>
            </div>

            <motion.button
              type="button"
              onClick={onClose}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 p-2 text-[var(--color-text)] transition"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </motion.button>
          </motion.div>

          {/* Body */}
          <div className="relative z-20 overflow-visible px-6 py-5">
            <AnimatePresence>
              {datePickerOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.14 }}
                  className="pointer-events-none absolute inset-0 z-[80] rounded-b-2xl bg-[rgb(var(--color-background-rgb)/0.28)] backdrop-blur-[1px]"
                />
              )}
            </AnimatePresence>
            <AnimatePresence initial={false}>
              {employeesError && (
                <motion.div
                  key="employeesError"
                  {...fadeUp(0)}
                  className="mb-3 rounded-xl border border-red-300/20 bg-red-300/10 px-3 py-2 text-xs text-red-200"
                >
                  {employeesError}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {formError && (
                <motion.div
                  key="formError"
                  {...fadeUp(0)}
                  className="mb-3 rounded-xl border border-red-300/20 bg-red-300/10 px-3 py-2 text-xs text-red-200"
                >
                  {formError}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative grid gap-3 overflow-visible sm:grid-cols-2">
              {/* Employee select */}
              <motion.div
                {...fadeUp(0.06)}
                className="relative z-[100] sm:col-span-2"
              >
                <label className="text-[10px] uppercase tracking-wide text-[var(--color-text)]/70">
                  Member
                </label>

                <SelectShell
                  label="Member"
                  value={employeeId}
                  onChange={setEmployeeId}
                  disabled={lockEmployee || loadingEmployees || saving}
                  className="mt-1 w-full max-w-[320px]"
                >
                  {loadingEmployees ? (
                    <option value="">Loading employees…</option>
                  ) : employees.length === 0 ? (
                    <option value="">No employees found</option>
                  ) : (
                    employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name || e.email || "Unnamed member"}
                      </option>
                    ))
                  )}
                </SelectShell>

                <p className="mt-1 text-[11px] text-[var(--color-text)]/70">
                  Tip: launch this from an employee page to lock the selection.
                </p>
              </motion.div>

              {/* Worked dates */}
              <motion.div
                {...fadeUp(0.09)}
                className="relative z-[90] sm:col-span-2"
              >
                <label className="text-[10px] uppercase tracking-wide text-[var(--color-text)]/70">
                  Worked dates
                </label>

                <MultiDatePicker
                  selectedDates={workedDates}
                  onChange={setWorkedDates}
                  disabled={saving || !employeeId}
                  inputBase={inputBase}
                  formatWorkDate={formatWorkDate}
                  onOpenChange={setDatePickerOpen}
                  blockedDates={blockedDates}
                />

                {Object.keys(blockedDates).length > 0 ? (
                  <div className="mt-2 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        Some dates are locked because this member already has
                        day-rate payouts for them. Edit or void the existing
                        payout instead of paying the same day twice.
                      </div>
                    </div>
                  </div>
                ) : null}

                {workedDates.length > 0 ? (
                  <div className="mt-2 grid max-h-[118px] grid-cols-2 gap-1.5 overflow-y-auto overscroll-contain section-scroll rounded-xl border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-background-rgb)/0.22)] p-2 pr-1">
                    {workedDates.map((date) => (
                      <div
                        key={date}
                        className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-[rgb(var(--color-border-rgb)/0.12)] bg-[var(--color-card)] px-2 py-1.5 text-[11px] text-[var(--color-text)]"
                      >
                        <span className="truncate">{formatWorkDate(date)}</span>

                        <button
                          type="button"
                          onClick={() => removeWorkedDate(date)}
                          disabled={saving}
                          className="rounded-md p-1 text-[var(--color-text)]/55 transition hover:bg-white/10 hover:text-[var(--color-text)]"
                          aria-label={`Remove ${date}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] text-[var(--color-text)]/60">
                    Select one or multiple worked dates, then click Done.
                  </p>
                )}
              </motion.div>

              {/* Rate per day */}
              <motion.div {...fadeUp(0.12)} className="relative z-[10]">
                <label className="text-[10px] uppercase tracking-wide text-[var(--color-text)]/70">
                  Rate per day ($)
                </label>
                <input
                  value={ratePerDay}
                  onChange={(e) => setRatePerDay(e.target.value)}
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="e.g. 250"
                  disabled={saving}
                  className={inputBase}
                />
              </motion.div>

              {/* Method */}
              <motion.div {...fadeUp(0.15)} className="relative z-[50]">
                <label className="text-[10px] uppercase tracking-wide text-[var(--color-text)]/70">
                  Method
                </label>

                <SelectShell
                  label="Method"
                  value={method}
                  onChange={(value) =>
                    setMethod(value as "cash" | "check" | "zelle" | "other")
                  }
                  disabled={saving}
                  className="mt-1 w-full"
                >
                  <option value="check">Check</option>
                  <option value="cash">Cash</option>
                  <option value="zelle">Zelle</option>
                  <option value="other">Other</option>
                </SelectShell>
              </motion.div>

              {/* Total preview */}
              <motion.div
                {...fadeUp(0.18)}
                className="relative z-[10] flex items-end"
              >
                <div className="w-full rounded-xl border border-white/10 bg-[var(--color-card)] px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-[var(--color-text)]/70">
                    Total
                  </div>
                  <div className="mt-1 text-lg font-semibold text-[var(--color-text)]">
                    {money(totalCents)}
                  </div>

                  {totalCents > 0 && (
                    <div className="mt-0.5 text-[11px] text-[var(--color-text)]/70">
                      {daysNum} day{daysNum === 1 ? "" : "s"} @{" "}
                      {(toCents(rateNum) / 100).toLocaleString(undefined, {
                        style: "currency",
                        currency: "USD",
                      })}
                      /day
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Note */}
              <motion.div
                {...fadeUp(0.21)}
                className="relative z-[1] sm:col-span-2"
              >
                <label className="text-[10px] uppercase tracking-wide text-[var(--color-text)]/70">
                  Note (optional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Week of Dec 9–13"
                  disabled={saving}
                  rows={2}
                  className={cx(inputBase, "resize-none")}
                />
              </motion.div>
            </div>
          </div>

          {/* Footer */}
          <motion.div
            {...fadeUp(0.24)}
            className="flex flex-col-reverse gap-2 border-t border-white/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <motion.button
              type="button"
              onClick={onClose}
              disabled={saving}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm font-semibold text-[var(--color-text)]/70 transition disabled:opacity-60"
            >
              Cancel
            </motion.button>

            <motion.button
              type="button"
              onClick={submit}
              disabled={saving || totalCents <= 0 || !employeeId}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.985 }}
              className={cx(
                "rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-60",
                "bg-[var(--color-card-hover)] hover:bg-[var(--btn-hover-bg)] text-[var(--btn-text)]"
              )}
            >
              {saving ? "Creating…" : "Create day-rate payout"}
            </motion.button>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
