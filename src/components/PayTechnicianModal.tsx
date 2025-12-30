import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import type { FieldValue } from "firebase/firestore";
import { X, Wrench } from "lucide-react";
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

export default function PayTechnicianModal({
  onClose,
  defaultEmployeeId,
  lockEmployee,
  orgId,
  onCreated,
  defaultRatePerDay,
  defaultMethod = "check",
}: PayTechnicianModalProps) {
  if (typeof document === "undefined") return null;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [employeesError, setEmployeesError] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState(defaultEmployeeId ?? "");
  const [daysWorked, setDaysWorked] = useState<string>("");
  const [ratePerDay, setRatePerDay] = useState<string>(
    typeof defaultRatePerDay === "number" ? String(defaultRatePerDay) : ""
  );
  const [method, setMethod] = useState<"cash" | "check" | "zelle" | "other">(
    defaultMethod
  );
  const [note, setNote] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load active employees (fallback to all if isActive missing)
  useEffect(() => {
    (async () => {
      if (!orgId) {
        setEmployees([]);
        setLoadingEmployees(false);
        return;
      }

      try {
        setLoadingEmployees(true);
        setEmployeesError(null);

        const ref = collection(db, "employees");

        // Try to fetch active employees first
        const qActive = query(
          ref,
          where("orgId", "==", orgId),
          where("isActive", "==", true),
          orderBy("name"),
          limit(200)
        );
        const activeSnap = await getDocs(qActive);

        let list: Employee[] = activeSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Employee, "id">),
        }));

        // If none found (or field missing across docs), fallback to all employees
        if (list.length === 0) {
          const qAll = query(
            ref,
            where("orgId", "==", orgId),
            orderBy("name"),
            limit(200)
          );
          const allSnap = await getDocs(qAll);
          list = allSnap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Employee, "id">),
          }));
        }

        setEmployees(list);

        // If no preselected employee, default to first
        if (!defaultEmployeeId && list.length > 0) {
          setEmployeeId((prev) => prev || list[0].id);
        }
      } catch (e) {
        setEmployeesError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoadingEmployees(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === employeeId) ?? null,
    [employees, employeeId]
  );

  const daysNum = useMemo(() => Number(daysWorked), [daysWorked]);
  const rateNum = useMemo(() => Number(ratePerDay), [ratePerDay]);

  const totalCents = useMemo(() => {
    if (!Number.isFinite(daysNum) || !Number.isFinite(rateNum)) return 0;
    if (daysNum <= 0 || rateNum <= 0) return 0;
    return Math.round(daysNum * toCents(rateNum));
  }, [daysNum, rateNum]);

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
    if (!Number.isFinite(daysNum) || daysNum <= 0) {
      setFormError("Enter days worked (must be greater than 0).");
      return;
    }
    if (!Number.isFinite(rateNum) || rateNum <= 0) {
      setFormError("Enter rate per day (must be greater than 0).");
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
      const payoutRef = doc(collection(db, "payouts"));

      // NOTE: keep the doc minimal + compatible with your existing dashboard renders
      const docData: Omit<PayoutDoc, "id"> & {
        memo?: string;
      } = {
        orgId,
        employeeId,
        employeeNameSnapshot: selectedEmployee.name,

        category: "technician",
        amountCents,

        // breakdown fields
        daysWorked: daysNum,
        ratePerDayCents,

        method,

        ...(note.trim().length ? { memo: note.trim() } : {}),

        createdAt: serverTimestamp() as unknown as FieldValue,

        // unpaid by default
        paidAt: null as any,
      };

      await setDoc(payoutRef, docData as any);

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
    "mt-1 w-full rounded-xl border border-[rgb(var(--color-border-rgb)/0.14)] bg-black/30 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-[var(--color-accent-gold)]/35 disabled:opacity-60";

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
            "relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border",
            "bg-[var(--color-surface)] backdrop-blur",
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
                <h2 className="text-xl font-semibold text-white tracking-wide">
                  Create day-rate payout
                </h2>
                <p className="mt-1 text-xs text-white/55">
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
              className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 p-2 text-white/70 transition"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </motion.button>
          </motion.div>

          {/* Body */}
          <div className="px-6 py-5 relative">
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

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Employee select */}
              <motion.div {...fadeUp(0.06)} className="sm:col-span-2">
                <label className="text-[10px] uppercase tracking-wide text-white/50">
                  Member
                </label>

                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  disabled={lockEmployee || loadingEmployees || saving}
                  className={cx(inputBase, "appearance-none")}
                >
                  {loadingEmployees && <option>Loading employees…</option>}
                  {!loadingEmployees && employees.length === 0 && (
                    <option value="">No employees found</option>
                  )}
                  {!loadingEmployees &&
                    employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                        {e.isActive === false ? " (inactive)" : ""}
                      </option>
                    ))}
                </select>

                <p className="mt-1 text-[11px] text-white/45">
                  Tip: launch this from an employee page to lock the selection.
                </p>
              </motion.div>

              {/* Days worked */}
              <motion.div {...fadeUp(0.09)}>
                <label className="text-[10px] uppercase tracking-wide text-white/50">
                  Days worked
                </label>
                <input
                  value={daysWorked}
                  onChange={(e) => setDaysWorked(e.target.value)}
                  type="number"
                  min={0}
                  step="1"
                  placeholder="e.g. 3"
                  disabled={saving}
                  className={inputBase}
                />
              </motion.div>

              {/* Rate per day */}
              <motion.div {...fadeUp(0.12)}>
                <label className="text-[10px] uppercase tracking-wide text-white/50">
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
              <motion.div {...fadeUp(0.15)}>
                <label className="text-[10px] uppercase tracking-wide text-white/50">
                  Method
                </label>
                <select
                  value={method}
                  onChange={(e) =>
                    setMethod(
                      e.target.value as "cash" | "check" | "zelle" | "other"
                    )
                  }
                  disabled={saving}
                  className={cx(inputBase, "appearance-none")}
                >
                  <option value="check">Check</option>
                  <option value="cash">Cash</option>
                  <option value="zelle">Zelle</option>
                  <option value="other">Other</option>
                </select>
              </motion.div>

              {/* Total preview */}
              <motion.div {...fadeUp(0.18)} className="flex items-end">
                <div className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-white/50">
                    Total
                  </div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    {money(totalCents)}
                  </div>

                  {totalCents > 0 && (
                    <div className="mt-0.5 text-[11px] text-white/50">
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
              <motion.div {...fadeUp(0.21)} className="sm:col-span-2">
                <label className="text-[10px] uppercase tracking-wide text-white/50">
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
              className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm font-semibold text-white/70 transition disabled:opacity-60"
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
                "bg-[var(--btn-bg)] hover:bg-[var(--btn-hover-bg)] text-[var(--btn-text)]"
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
