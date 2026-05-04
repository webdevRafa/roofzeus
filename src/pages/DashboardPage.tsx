import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CalendarDays,
  CalendarOff,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  DollarSign,
  X,
  WalletCards,
} from "lucide-react";

import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { useOrgJobsData } from "../hooks/useOrgJobsData";
import { useDashboardPayoutsData } from "../hooks/useDashboardPayoutsData";
import type { Job, JobStatus, PayoutDoc } from "../types/types";

type FsTimestampLike = { toDate: () => Date };

function isFsTimestamp(x: unknown): x is FsTimestampLike {
  return typeof (x as FsTimestampLike)?.toDate === "function";
}

function toMillis(v: unknown): number | null {
  if (!v) return null;
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

function fmtDateOnly(v: unknown): string {
  const ms = toMillis(v);
  if (ms == null) return "—";

  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function money(cents: number | null | undefined): string {
  const value = typeof cents === "number" ? cents : 0;

  return (value / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return "";
}

function addr(
  a: Job["address"] | PayoutDoc["jobAddressSnapshot"] | null | undefined
) {
  if (typeof a === "string") {
    return {
      display: a,
      line1: a,
      city: "",
      state: "",
      zip: "",
      cityStateZip: "",
    };
  }

  const obj: Record<string, unknown> =
    (a as unknown as Record<string, unknown>) ?? {};

  const line1 =
    pickString(obj, [
      "line1",
      "street",
      "address1",
      "address",
      "line",
      "street1",
    ]) || pickString(obj, ["fullLine", "full", "formatted", "text", "label"]);

  const city = pickString(obj, ["city", "town"]);
  const state = pickString(obj, ["state", "region", "province"]);
  const zip = pickString(obj, ["zip", "postalCode", "postcode", "zipCode"]);

  const cityStateZip = [city, state].filter(Boolean).join(", ");
  const cityStateZipWithPostal = [cityStateZip, zip].filter(Boolean).join(" ");

  const display =
    pickString(obj, ["fullLine", "full", "formatted", "label", "text"]) ||
    [line1, cityStateZipWithPostal].filter(Boolean).join(", ");

  return {
    display,
    line1,
    city,
    state,
    zip,
    cityStateZip: cityStateZipWithPostal,
  };
}

function payoutEmployeeName(payout: PayoutDoc): string {
  const snapshot = (payout as any).employeeNameSnapshot;

  if (!snapshot) return "";
  if (typeof snapshot === "string") return snapshot;

  if (typeof snapshot === "object") {
    return pickString(snapshot as Record<string, unknown>, [
      "name",
      "fullName",
      "displayName",
    ]);
  }

  return "";
}

function payoutCategoryLabel(category: PayoutDoc["category"] | undefined) {
  if (category === "felt") return "Dry In";
  if (category === "shingles") return "Shingles";
  if (category === "technician") return "Day rate";
  return "Payout";
}

function statusClasses(status: JobStatus) {
  switch (status) {
    case "active":
      return "text-[var(--color-accent-gold)]";
    case "pending":
      return "text-[rgb(var(--pill-warning-rgb))]";
    case "completed":
    case "paid":
      return "text-[rgb(var(--pill-success-rgb))]";
    case "invoiced":
      return "text-[rgb(var(--pill-info-rgb))]";
    case "closed":
    case "archived":
    case "draft":
    default:
      return "text-[rgb(var(--color-text-rgb)/0.62)]";
  }
}

function isJobFullyComplete(job: Job) {
  return (
    job.status === "completed" ||
    job.status === "closed" ||
    job.status === "archived" ||
    Boolean((job as any).punchedAt)
  );
}

function stageSummary(job: Job): string {
  const feltScheduled = toMillis((job as any).feltScheduledFor ?? null);
  const feltDone = toMillis((job as any).feltCompletedAt ?? null);

  const shinglesScheduled = toMillis((job as any).shinglesScheduledFor ?? null);
  const shinglesDone = toMillis((job as any).shinglesCompletedAt ?? null);

  const punchScheduled = toMillis((job as any).punchScheduledFor ?? null);
  const punchedAt = toMillis((job as any).punchedAt ?? null);

  if (punchedAt) return `Punch completed • ${fmtDateOnly(punchedAt)}`;
  if (punchScheduled) return `Punch scheduled • ${fmtDateOnly(punchScheduled)}`;

  if (feltDone && shinglesDone) return "Dry In + Shingles done • needs punch";
  if (shinglesDone) return `Shingles completed • ${fmtDateOnly(shinglesDone)}`;
  if (shinglesScheduled) {
    return `Shingles scheduled • ${fmtDateOnly(shinglesScheduled)}`;
  }

  if (feltDone) return `Dry In completed • ${fmtDateOnly(feltDone)}`;
  if (feltScheduled) return `Dry In scheduled • ${fmtDateOnly(feltScheduled)}`;

  return "No production schedule yet";
}

function startOfTodayMs() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function isStageBehindSchedule({
  scheduledAt,
  completedAt,
  todayStartMs,
}: {
  scheduledAt: unknown;
  completedAt: unknown;
  todayStartMs: number;
}) {
  const scheduledMs = toMillis(scheduledAt);
  const completedMs = toMillis(completedAt);

  // If the stage is already completed, it should not count as behind.
  if (completedMs != null) return false;

  // Only scheduled stages can be behind.
  if (scheduledMs == null) return false;

  // "Older than today" means yesterday or earlier.
  return scheduledMs < todayStartMs;
}

function getBehindScheduleStages(job: Job, todayStartMs = startOfTodayMs()) {
  const stages = [
    {
      label: "Dry In",
      scheduledAt: (job as any).feltScheduledFor ?? null,
      completedAt: (job as any).feltCompletedAt ?? null,
    },
    {
      label: "Shingles",
      scheduledAt: (job as any).shinglesScheduledFor ?? null,
      completedAt: (job as any).shinglesCompletedAt ?? null,
    },
    {
      label: "Punch",
      scheduledAt: (job as any).punchScheduledFor ?? null,
      completedAt: (job as any).punchedAt ?? null,
    },
  ];

  return stages.filter((stage) =>
    isStageBehindSchedule({
      scheduledAt: stage.scheduledAt,
      completedAt: stage.completedAt,
      todayStartMs,
    })
  );
}

function oldestBehindScheduleMs(job: Job, todayStartMs = startOfTodayMs()) {
  const behindStages = getBehindScheduleStages(job, todayStartMs)
    .map((stage) => toMillis(stage.scheduledAt))
    .filter((ms): ms is number => ms != null);

  if (behindStages.length === 0) return Number.POSITIVE_INFINITY;

  return Math.min(...behindStages);
}

type ScheduleStageKey = "dryIn" | "shingles" | "punch";

type ScheduleStageConfig = {
  label: string;
  field: "feltScheduledFor" | "shinglesScheduledFor" | "punchScheduledFor";
  completedField: "feltCompletedAt" | "shinglesCompletedAt" | "punchedAt";
};

const scheduleStageConfig: Record<ScheduleStageKey, ScheduleStageConfig> = {
  dryIn: {
    label: "Dry In",
    field: "feltScheduledFor",
    completedField: "feltCompletedAt",
  },
  shingles: {
    label: "Shingles",
    field: "shinglesScheduledFor",
    completedField: "shinglesCompletedAt",
  },
  punch: {
    label: "Punch",
    field: "punchScheduledFor",
    completedField: "punchedAt",
  },
};

function ymdFromUnknown(value: unknown): string {
  const ms = toMillis(value);
  if (ms == null) return "";

  const date = new Date(ms);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function singleDateToDate(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function SingleDatePicker({
  selectedDate,
  onChange,
  disabled,
}: {
  selectedDate: string;
  onChange: (date: string) => void;
  disabled?: boolean;
}) {
  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) {
      const [year, month, day] = selectedDate.split("-").map(Number);
      return new Date(year, month - 1, day || 1);
    }

    return new Date();
  });

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

  function goMonth(direction: -1 | 1) {
    setViewDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1)
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[rgb(var(--color-border-rgb)/0.22)] bg-[var(--color-card)] shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-3">
        <button
          type="button"
          onClick={() => goMonth(-1)}
          disabled={disabled}
          className="rounded-lg p-2 text-[var(--color-text)]/70 transition hover:bg-white/10 hover:text-[var(--color-text)] disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="text-sm font-semibold text-[var(--color-text)]">
          {monthLabel}
        </div>

        <button
          type="button"
          onClick={() => goMonth(1)}
          disabled={disabled}
          className="rounded-lg p-2 text-[var(--color-text)]/70 transition hover:bg-white/10 hover:text-[var(--color-text)] disabled:opacity-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 px-3 pt-3 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text)]/45">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 p-3">
        {calendarDays.map(({ ymd, date, inMonth }) => {
          const selected = selectedDate === ymd;

          return (
            <button
              key={ymd}
              type="button"
              disabled={disabled}
              onClick={() => onChange(ymd)}
              className={[
                "relative grid h-9 place-items-center rounded-xl text-xs font-semibold transition",
                inMonth
                  ? "text-[var(--color-text)]"
                  : "text-[var(--color-text)]/30",
                selected
                  ? "bg-[var(--btn-bg)] text-[var(--btn-text)] ring-2 ring-[var(--color-accent-gold)]/70 shadow-[0_0_0_4px_rgb(var(--color-primary-rgb)/0.18)]"
                  : "hover:bg-[var(--color-card-hover)]",
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
              ].join(" ")}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScheduleStageModal({
  job,
  stage,
  selectedDate,
  saving,
  onDateChange,
  onClose,
  onSave,
}: {
  job: Job;
  stage: ScheduleStageKey;
  selectedDate: string;
  saving: boolean;
  onDateChange: (date: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const stageInfo = scheduleStageConfig[stage];
  const a = addr(job.address);
  const currentScheduledMs = toMillis((job as any)[stageInfo.field] ?? null);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: 14, scale: 0.98, filter: "blur(8px)" }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[390px] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-[0_30px_90px_rgba(0,0,0,0.65)]"
      >
        <div className="border-b border-[var(--color-border)] bg-[rgb(var(--color-surface-rgb)/0.35)] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-surface-rgb)/0.55)] text-[var(--color-accent-gold)]">
                  <CalendarDays className="h-4 w-4" />
                </span>

                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold text-[var(--color-text)]">
                    {a.line1 || a.display || "Untitled job"}
                  </h3>

                  {a.cityStateZip ? (
                    <p className="mt-0.5 truncate text-xs text-[rgb(var(--color-text-rgb)/0.58)]">
                      {a.cityStateZip}
                    </p>
                  ) : null}
                </div>
              </div>

              <p className="mt-4 text-sm font-semibold text-[var(--color-text)]">
                {currentScheduledMs ? "Rescheduling" : "Scheduling"}{" "}
                {stageInfo.label}
              </p>

              <p className="mt-1 text-xs text-[rgb(var(--color-text-rgb)/0.58)]">
                Pick the new scheduled date below. This updates the job schedule
                immediately after you save.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-surface-rgb)/0.45)] p-2 text-[var(--color-text)]/70 transition hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text)] disabled:opacity-60"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <SingleDatePicker
            selectedDate={selectedDate}
            onChange={onDateChange}
            disabled={saving}
          />

          <div className="rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.35)] px-3 py-2 text-xs text-[rgb(var(--color-text-rgb)/0.62)]">
            {selectedDate ? (
              <>
                Selected:{" "}
                <span className="font-semibold text-[var(--color-text)]">
                  {fmtDateOnly(singleDateToDate(selectedDate))}
                </span>
              </>
            ) : (
              "Select a date to continue."
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] bg-[rgb(var(--color-surface-rgb)/0.30)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-text-rgb)/0.04)] px-3 py-2 text-xs font-semibold text-[rgb(var(--color-text-rgb)/0.72)] transition hover:bg-[rgb(var(--color-text-rgb)/0.08)] hover:text-[var(--color-text)] disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={!selectedDate || saving}
            className="rounded-xl border border-[var(--color-accent-gold)]/30 bg-[var(--color-accent-gold)]/15 px-4 py-2 text-xs font-semibold text-[var(--color-accent-gold)] transition hover:bg-[var(--color-accent-gold)]/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save date"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function TableShell({
  title,
  subtitle,
  count,
  icon,
  children,
  emptyText,
  open,
  onToggle,
}: {
  title: string;
  subtitle: string;
  count: number;
  icon: ReactNode;
  children: ReactNode;
  emptyText: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="rz-dashboard-card overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]/60 hover:shadow-md mb-10">
      <header className="border-b border-[var(--color-border)] px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] text-[var(--color-accent-gold)]">
              {icon}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold tracking-wide text-[var(--color-text)] sm:text-lg">
                  {title}
                </h2>

                <span className="rounded-full border border-[var(--color-accent-gold)]/30 bg-[var(--color-accent-gold)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--color-accent-gold)]">
                  {count}
                </span>
              </div>

              <p className="mt-1 text-[12px] text-[rgb(var(--color-text-rgb)/0.58)]">
                {subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center justify-center gap-1 rounded-full border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-1.5 text-[11px] font-semibold text-[rgb(var(--color-text-rgb)/0.78)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.75)]"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                open ? "rotate-0" : "-rotate-90"
              }`}
            />
            <span>{open ? "Collapse" : "Expand"}</span>
          </button>
        </div>
      </header>

      {open && (
        <div>
          {count === 0 ? (
            <div className="px-4 py-6 text-sm text-[rgb(var(--color-text-rgb)/0.58)] sm:px-6">
              {emptyText}
            </div>
          ) : (
            children
          )}
        </div>
      )}
    </section>
  );
}

function StageCell({
  scheduledAt,
  completedAt,
  job,
  stage,
  onOpenSchedule,
}: {
  scheduledAt: unknown;
  completedAt: unknown;
  job: Job;
  stage: ScheduleStageKey;
  onOpenSchedule?: (job: Job, stage: ScheduleStageKey) => void;
}) {
  const completedMs = toMillis(completedAt);
  const scheduledMs = toMillis(scheduledAt);

  if (completedMs != null) {
    return (
      <div className="min-w-0">
        <div className="inline-flex rounded-full border border-[rgb(var(--pill-success-rgb)/0.24)] bg-[rgb(var(--pill-success-rgb)/0.10)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[rgb(var(--pill-success-rgb)/0.92)]">
          Completed
        </div>

        <div className="mt-1 truncate text-[11px] text-[rgb(var(--color-text-rgb)/0.58)]">
          {fmtDateOnly(completedMs)}
        </div>
      </div>
    );
  }

  if (scheduledMs != null) {
    const canOpen = Boolean(onOpenSchedule);

    return (
      <div className="min-w-0">
        <button
          type="button"
          disabled={!canOpen}
          onClick={() => onOpenSchedule?.(job, stage)}
          title={canOpen ? "Click to reschedule" : undefined}
          className={[
            "group inline-flex w-[82px] justify-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition",
            "border-[rgb(var(--color-border-rgb)/0.28)] bg-[rgb(var(--color-surface-rgb)/0.34)] text-[rgb(var(--color-text-rgb)/0.68)]",
            canOpen
              ? "cursor-pointer hover:border-[var(--color-accent-gold)]/35 hover:bg-[var(--color-accent-gold)]/12 hover:text-[var(--color-accent-gold)] hover:shadow-[0_0_0_1px_rgb(var(--color-primary-rgb)/0.10)]"
              : "cursor-default",
          ].join(" ")}
        >
          <span className="group-hover:hidden">Scheduled</span>
          <span className="hidden group-hover:inline">Reschedule</span>
        </button>

        <div className="mt-1 truncate text-[11px] text-[rgb(var(--color-text-rgb)/0.56)]">
          {fmtDateOnly(scheduledMs)}
        </div>
      </div>
    );
  }

  const canOpen = Boolean(onOpenSchedule);

  return (
    <div className="min-w-0">
      <button
        type="button"
        disabled={!canOpen}
        onClick={() => onOpenSchedule?.(job, stage)}
        title={canOpen ? "Click to schedule" : undefined}
        className={[
          "group inline-flex w-[104px] justify-center rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide transition",
          "border-[rgb(var(--pill-warning-rgb)/0.36)] bg-[rgb(var(--pill-warning-rgb)/0.14)] text-[rgb(var(--pill-warning-rgb))] shadow-[0_0_0_1px_rgb(var(--pill-warning-rgb)/0.08)]",
          canOpen
            ? "cursor-pointer hover:bg-[rgb(var(--pill-warning-rgb)/0.20)] hover:shadow-[0_0_0_2px_rgb(var(--pill-warning-rgb)/0.10)]"
            : "cursor-default",
        ].join(" ")}
      >
        <span className="group-hover:hidden">Needs schedule</span>
        <span className="hidden group-hover:inline">Schedule</span>
      </button>

      <div className="mt-1 truncate text-[11px] font-medium text-[rgb(var(--pill-warning-rgb)/0.78)]">
        Not set
      </div>
    </div>
  );
}

function BehindScheduleStageCell({
  scheduledAt,
  completedAt,
  job,
  stage,
  onOpenSchedule,
}: {
  scheduledAt: unknown;
  completedAt: unknown;
  job: Job;
  stage: ScheduleStageKey;
  onOpenSchedule?: (job: Job, stage: ScheduleStageKey) => void;
}) {
  const completedMs = toMillis(completedAt);
  const scheduledMs = toMillis(scheduledAt);
  const behind = isStageBehindSchedule({
    scheduledAt,
    completedAt,
    todayStartMs: startOfTodayMs(),
  });

  if (completedMs != null) {
    return (
      <div className="min-w-0">
        <div className="inline-flex rounded-full border border-[rgb(var(--pill-success-rgb)/0.24)] bg-[rgb(var(--pill-success-rgb)/0.10)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[rgb(var(--pill-success-rgb)/0.92)]">
          Completed
        </div>
        <div className="mt-1 truncate text-[11px] text-[rgb(var(--color-text-rgb)/0.58)]">
          {fmtDateOnly(completedMs)}
        </div>
      </div>
    );
  }

  if (scheduledMs != null && behind) {
    const canOpen = Boolean(onOpenSchedule);

    return (
      <div className="min-w-0">
        <button
          type="button"
          disabled={!canOpen}
          onClick={() => onOpenSchedule?.(job, stage)}
          title={canOpen ? "Click to reschedule" : undefined}
          className={[
            "group inline-flex w-[82px] justify-center rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide transition",
            "border-red-400/30 bg-red-500/10 text-red-300 shadow-[0_0_0_1px_rgba(248,113,113,0.08)]",
            canOpen
              ? "cursor-pointer hover:border-[rgb(var(--color-border-rgb)/0.28)] hover:bg-[rgb(var(--color-text-rgb)/0.06)] hover:text-[var(--color-text)] hover:shadow-[0_0_0_2px_rgb(var(--color-text-rgb)/0.08)]"
              : "cursor-default",
          ].join(" ")}
        >
          <span className="group-hover:hidden">Behind</span>
          <span className="hidden group-hover:inline">Reschedule</span>
        </button>

        <div className="mt-1 truncate text-[11px] font-medium text-red-300/80">
          {fmtDateOnly(scheduledMs)}
        </div>
      </div>
    );
  }

  if (scheduledMs != null) {
    return (
      <div className="min-w-0">
        <div className="inline-flex rounded-full border border-[rgb(var(--pill-success-rgb)/0.24)] bg-[rgb(var(--pill-success-rgb)/0.10)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[rgb(var(--pill-success-rgb)/0.90)]">
          On time
        </div>
        <div className="mt-1 truncate text-[11px] text-[rgb(var(--color-text-rgb)/0.56)]">
          {fmtDateOnly(scheduledMs)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="inline-flex rounded-full border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-surface-rgb)/0.30)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.50)]">
        Not set
      </div>
      <div className="mt-1 truncate text-[11px] text-[rgb(var(--color-text-rgb)/0.42)]">
        —
      </div>
    </div>
  );
}
function JobTable({
  jobs,
  mode,
  navigate,
  onOpenSchedule,
}: {
  jobs: Job[];
  mode: "pendingCompletion" | "behindSchedule" | "unscheduled" | "noPayouts";
  navigate: (path: string) => void;
  onOpenSchedule?: (job: Job, stage: ScheduleStageKey) => void;
}) {
  const isStageTable =
    mode === "pendingCompletion" ||
    mode === "behindSchedule" ||
    mode === "unscheduled";

  return (
    <div className="max-h-[420px] overflow-y-auto section-scroll">
      <table className="w-full table-fixed text-sm">
        {isStageTable ? (
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[10%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col className="w-[10%]" />
            <col className="w-[12%]" />
            <col className="w-[7%]" />
          </colgroup>
        ) : (
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[13%]" />
            <col className="w-[29%]" />
            <col className="w-[11%]" />
            <col className="w-[13%]" />
            <col className="w-[6%]" />
          </colgroup>
        )}

        <thead className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-card)]/60 backdrop-blur">
          {isStageTable ? (
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.70)]">
              <th className="px-4 py-3">Job</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Dry In</th>
              <th className="px-4 py-3">Shingles</th>
              <th className="px-4 py-3">Punch</th>
              <th className="px-4 py-3 text-right">Profit</th>
              <th className="px-4 py-3">Last updated</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          ) : (
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.70)]">
              <th className="px-4 py-3">Job</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Stage note</th>
              <th className="px-4 py-3 text-right">Profit</th>
              <th className="px-4 py-3">Last updated</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          )}
        </thead>

        <tbody className="divide-y divide-[rgb(var(--color-border-rgb)/0.12)]">
          {jobs.map((job) => {
            const a = addr(job.address);

            const feltScheduledFor = (job as any).feltScheduledFor ?? null;
            const feltCompletedAt = (job as any).feltCompletedAt ?? null;

            const shinglesScheduledFor =
              (job as any).shinglesScheduledFor ?? null;
            const shinglesCompletedAt =
              (job as any).shinglesCompletedAt ?? null;

            const punchScheduledFor = (job as any).punchScheduledFor ?? null;
            const punchedAt = (job as any).punchedAt ?? null;

            return (
              <tr
                key={job.id}
                className="rz-dashboard-table-row bg-[rgb(var(--color-surface-rgb)/0.42)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.68)]"
              >
                <td className="px-4 py-3 align-middle">
                  <div className="truncate font-semibold text-[var(--color-text)]">
                    {a.line1 || a.display || "Untitled job"}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-[rgb(var(--color-text-rgb)/0.58)]">
                    {a.cityStateZip || "—"}
                  </div>
                </td>

                <td className="px-4 py-3 align-middle">
                  <span
                    className={`inline-flex max-w-full truncate text-[11px] font-bold uppercase tracking-wide ${statusClasses(
                      job.status
                    )}`}
                  >
                    {job.status}
                  </span>
                </td>

                {isStageTable ? (
                  <>
                    <td className="px-4 py-3 align-middle">
                      {mode === "behindSchedule" ? (
                        <BehindScheduleStageCell
                          scheduledAt={feltScheduledFor}
                          completedAt={feltCompletedAt}
                          job={job}
                          stage="dryIn"
                          onOpenSchedule={onOpenSchedule}
                        />
                      ) : (
                        <StageCell
                          scheduledAt={feltScheduledFor}
                          completedAt={feltCompletedAt}
                          job={job}
                          stage="dryIn"
                          onOpenSchedule={onOpenSchedule}
                        />
                      )}
                    </td>

                    <td className="px-4 py-3 align-middle">
                      {mode === "behindSchedule" ? (
                        <BehindScheduleStageCell
                          scheduledAt={shinglesScheduledFor}
                          completedAt={shinglesCompletedAt}
                          job={job}
                          stage="shingles"
                          onOpenSchedule={onOpenSchedule}
                        />
                      ) : (
                        <StageCell
                          scheduledAt={shinglesScheduledFor}
                          completedAt={shinglesCompletedAt}
                          job={job}
                          stage="shingles"
                          onOpenSchedule={onOpenSchedule}
                        />
                      )}
                    </td>

                    <td className="px-4 py-3 align-middle">
                      {mode === "behindSchedule" ? (
                        <BehindScheduleStageCell
                          scheduledAt={punchScheduledFor}
                          completedAt={punchedAt}
                          job={job}
                          stage="punch"
                          onOpenSchedule={onOpenSchedule}
                        />
                      ) : (
                        <StageCell
                          scheduledAt={punchScheduledFor}
                          completedAt={punchedAt}
                          job={job}
                          stage="punch"
                          onOpenSchedule={onOpenSchedule}
                        />
                      )}
                    </td>
                  </>
                ) : (
                  <td className="px-4 py-3 align-middle">
                    <div className="truncate text-[12px] font-medium text-[rgb(var(--color-text-rgb)/0.82)]">
                      {stageSummary(job)}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-[rgb(var(--color-text-rgb)/0.50)]">
                      Created {fmtDateTime(job.createdAt)}
                    </div>
                  </td>
                )}

                <td className="px-4 py-3 text-right align-middle font-semibold text-[rgb(var(--pill-success-rgb))]">
                  {money(job.computed?.netProfitCents ?? 0)}
                </td>

                <td className="px-4 py-3 align-middle text-[12px] text-[rgb(var(--color-text-rgb)/0.72)]">
                  <div className="truncate">
                    {fmtDateTime(job.updatedAt ?? job.createdAt)}
                  </div>
                </td>

                <td className="px-4 py-3 text-right align-middle">
                  <button
                    type="button"
                    onClick={() => navigate(`/job/${job.id}`)}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-[rgb(var(--color-border-rgb)/0.28)] bg-[rgb(var(--color-background-rgb)/0.35)] px-3 py-1.5 text-[12px] font-semibold text-[rgb(var(--color-text-rgb)/0.82)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.75)] hover:text-[var(--color-text)]"
                  >
                    View
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PayoutTable({
  payouts,
  navigate,
}: {
  payouts: PayoutDoc[];
  navigate: (path: string) => void;
}) {
  return (
    <div className="max-h-[420px] overflow-y-auto section-scroll">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[22%]" />
          <col className="w-[34%]" />
          <col className="w-[11%]" />
          <col className="w-[11%]" />
          <col className="w-[15%]" />
          <col className="w-[7%]" />
        </colgroup>

        <thead className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-card)]/95 backdrop-blur">
          <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.70)]">
            <th className="px-4 py-3">Member</th>
            <th className="px-4 py-3">Payout</th>
            <th className="px-4 py-3">Method</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-[rgb(var(--color-border-rgb)/0.12)]">
          {payouts.map((payout) => {
            const a = addr(payout.jobAddressSnapshot);
            const hasJob = Boolean(payout.jobId);

            return (
              <tr
                key={payout.id}
                className="rz-dashboard-table-row bg-[rgb(var(--color-surface-rgb)/0.42)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.68)]"
              >
                <td className="px-4 py-3 align-middle">
                  <div className="truncate font-semibold text-[var(--color-text)]">
                    {payoutEmployeeName(payout) || "Unknown member"}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-[rgb(var(--color-text-rgb)/0.58)]">
                    Pending payout
                  </div>
                </td>

                <td className="px-4 py-3 align-middle">
                  <div className="truncate text-[12px] font-semibold text-[rgb(var(--color-text-rgb)/0.82)]">
                    {payoutCategoryLabel(payout.category)}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-[rgb(var(--color-text-rgb)/0.55)]">
                    {a.display ||
                      payout.note ||
                      payout.memo ||
                      "Day-rate payout"}
                  </div>
                </td>

                <td className="px-4 py-3 align-middle">
                  <span className="truncate text-[11px] font-bold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.62)]">
                    {payout.method}
                  </span>
                </td>

                <td className="px-4 py-3 text-right align-middle font-semibold text-[var(--color-accent-gold)]">
                  {money(payout.amountCents)}
                </td>

                <td className="px-4 py-3 align-middle text-[12px] text-[rgb(var(--color-text-rgb)/0.72)]">
                  <div className="truncate">
                    {fmtDateTime(payout.createdAt)}
                  </div>
                </td>

                <td className="px-4 py-3 text-right align-middle">
                  {hasJob ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/job/${payout.jobId}`)}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-[rgb(var(--color-border-rgb)/0.28)] bg-[rgb(var(--color-background-rgb)/0.35)] px-3 py-1.5 text-[12px] font-semibold text-[rgb(var(--color-text-rgb)/0.82)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.75)] hover:text-[var(--color-text)]"
                    >
                      View
                    </button>
                  ) : (
                    <span className="inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.35)] px-3 py-1.5 text-[12px] font-semibold text-[rgb(var(--color-text-rgb)/0.42)]">
                      —
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
export default function DashboardPage() {
  const navigate = useNavigate();

  const { orgId, membershipLoading, jobs, loading } = useOrgJobsData();

  const { payouts, payoutsLoading, payoutsError } = useDashboardPayoutsData();

  const [openSections, setOpenSections] = useState({
    pendingCompletion: true,
    behindSchedule: true,
    pendingPayouts: true,
    unscheduled: true,
    noPayouts: true,
  });

  const [scheduleModal, setScheduleModal] = useState<{
    job: Job;
    stage: ScheduleStageKey;
  } | null>(null);

  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const pendingCompletionJobs = useMemo(() => {
    return jobs
      .filter((job) => {
        if (isJobFullyComplete(job)) return false;

        const hasFeltSchedule = Boolean(
          toMillis((job as any).feltScheduledFor ?? null)
        );
        const hasShinglesSchedule = Boolean(
          toMillis((job as any).shinglesScheduledFor ?? null)
        );
        const hasPunchSchedule = Boolean(
          toMillis((job as any).punchScheduledFor ?? null)
        );

        // Only show jobs here once at least one roofing stage has been scheduled.
        // Fully unscheduled jobs should live in the "Unscheduled jobs" section only.
        return hasFeltSchedule || hasShinglesSchedule || hasPunchSchedule;
      })
      .sort((a, b) => {
        const aMs = toMillis(a.updatedAt ?? a.createdAt) ?? 0;
        const bMs = toMillis(b.updatedAt ?? b.createdAt) ?? 0;
        return bMs - aMs;
      });
  }, [jobs]);

  const behindScheduleJobs = useMemo(() => {
    const todayStartMs = startOfTodayMs();

    return jobs
      .filter((job) => {
        if (isJobFullyComplete(job)) return false;

        return getBehindScheduleStages(job, todayStartMs).length > 0;
      })
      .sort((a, b) => {
        const aOldestBehind = oldestBehindScheduleMs(a, todayStartMs);
        const bOldestBehind = oldestBehindScheduleMs(b, todayStartMs);

        if (aOldestBehind !== bOldestBehind) {
          return aOldestBehind - bOldestBehind;
        }

        const aUpdated = toMillis(a.updatedAt ?? a.createdAt) ?? 0;
        const bUpdated = toMillis(b.updatedAt ?? b.createdAt) ?? 0;

        return bUpdated - aUpdated;
      });
  }, [jobs]);

  const pendingPayouts = useMemo(() => {
    return payouts
      .filter((payout) => !payout.paidAt)
      .sort((a, b) => {
        const aMs = toMillis(a.createdAt) ?? 0;
        const bMs = toMillis(b.createdAt) ?? 0;
        return bMs - aMs;
      });
  }, [payouts]);

  const unscheduledJobs = useMemo(() => {
    return jobs
      .filter((job) => {
        if (isJobFullyComplete(job)) return false;

        const hasFeltSchedule = Boolean(
          toMillis((job as any).feltScheduledFor ?? null)
        );
        const hasShinglesSchedule = Boolean(
          toMillis((job as any).shinglesScheduledFor ?? null)
        );
        const hasPunchSchedule = Boolean(
          toMillis((job as any).punchScheduledFor ?? null)
        );

        // Only show jobs that are unscheduled for ALL 3 roofing stages.
        return !hasFeltSchedule && !hasShinglesSchedule && !hasPunchSchedule;
      })
      .sort((a, b) => {
        const aMs = toMillis(a.updatedAt ?? a.createdAt) ?? 0;
        const bMs = toMillis(b.updatedAt ?? b.createdAt) ?? 0;
        return bMs - aMs;
      });
  }, [jobs]);

  const jobsWithNoPayouts = useMemo(() => {
    const jobIdsWithPayoutDocs = new Set(
      payouts
        .map((payout) => payout.jobId)
        .filter((jobId): jobId is string => Boolean(jobId))
    );

    return jobs
      .filter((job) => {
        const hasMirroredPayout = jobIdsWithPayoutDocs.has(job.id);
        const hasEmbeddedPayouts = (job.expenses?.payouts ?? []).length > 0;

        return !hasMirroredPayout && !hasEmbeddedPayouts;
      })
      .sort((a, b) => {
        const aMs = toMillis(a.updatedAt ?? a.createdAt) ?? 0;
        const bMs = toMillis(b.updatedAt ?? b.createdAt) ?? 0;
        return bMs - aMs;
      });
  }, [jobs, payouts]);

  function openScheduleModal(job: Job, stage: ScheduleStageKey) {
    const stageInfo = scheduleStageConfig[stage];
    const existingDate = ymdFromUnknown((job as any)[stageInfo.field] ?? null);

    setScheduleModal({ job, stage });
    setScheduleDate(existingDate || ymdFromUnknown(new Date()));
  }

  function closeScheduleModal() {
    if (scheduleSaving) return;

    setScheduleModal(null);
    setScheduleDate("");
  }

  async function saveScheduleDate() {
    if (!scheduleModal || !scheduleDate) return;

    const activeOrgId = orgId;

    if (!activeOrgId) {
      alert("No organization selected. Please refresh and try again.");
      return;
    }

    try {
      setScheduleSaving(true);

      const stageInfo = scheduleStageConfig[scheduleModal.stage];

      await setDoc(
        doc(db, "organizations", activeOrgId, "jobs", scheduleModal.job.id),
        {
          [stageInfo.field]: singleDateToDate(scheduleDate),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setScheduleModal(null);
      setScheduleDate("");
    } catch (error) {
      console.error("Failed to save scheduled date", error);
      alert("Failed to save scheduled date. Please try again.");
    } finally {
      setScheduleSaving(false);
    }
  }

  const isBusy = membershipLoading || loading;

  if (isBusy) {
    return (
      <div className="p-4 text-[var(--color-text)]">Loading organization…</div>
    );
  }

  if (!orgId) {
    return (
      <div className="p-8 text-red-600">
        You are not linked to an organization. Please contact your admin.
      </div>
    );
  }

  return (
    <div className="rz-dashboard-shell w-full min-h-screen pb-10">
      <motion.div
        className="mx-auto w-full max-w-[1400px] px-4 sm:px-6"
        initial="initial"
        animate="animate"
      >
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="pt-5">
            <h1 className="text-xl font-semibold tracking-wide text-[var(--color-text)] sm:text-2xl">
              Command Center
            </h1>
            <p className="mt-1 text-sm text-[rgb(var(--color-text-rgb)/0.58)]">
              Work queues for completion, payouts, scheduling, and payout
              coverage.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-1 text-[rgb(var(--color-text-rgb)/0.62)]">
              Jobs:{" "}
              <span className="font-semibold text-[rgb(var(--color-text-rgb)/0.90)]">
                {jobs.length}
              </span>
            </span>

            <span className="rounded-full border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-1 text-[rgb(var(--color-text-rgb)/0.62)]">
              Payouts:{" "}
              <span className="font-semibold text-[rgb(var(--color-text-rgb)/0.90)]">
                {payouts.length}
              </span>
            </span>
          </div>
        </div>

        {payoutsError && (
          <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {payoutsError}
          </div>
        )}

        {payoutsLoading && (
          <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[rgb(var(--color-text-rgb)/0.62)]">
            Loading payouts…
          </div>
        )}

        <div className="space-y-5">
          <TableShell
            title="Jobs pending completion"
            subtitle="Jobs that still need final punch completion."
            count={pendingCompletionJobs.length}
            icon={<ClipboardCheck className="h-4 w-4" />}
            open={openSections.pendingCompletion}
            onToggle={() =>
              setOpenSections((prev) => ({
                ...prev,
                pendingCompletion: !prev.pendingCompletion,
              }))
            }
            emptyText="No jobs are pending completion."
          >
            <JobTable
              jobs={pendingCompletionJobs}
              mode="pendingCompletion"
              navigate={navigate}
              onOpenSchedule={openScheduleModal}
            />
          </TableShell>

          <TableShell
            title="Jobs behind schedule"
            subtitle="Jobs with Dry In, Shingles, or Punch scheduled before today and not yet completed."
            count={behindScheduleJobs.length}
            icon={<AlertTriangle className="h-4 w-4" />}
            open={openSections.behindSchedule}
            onToggle={() =>
              setOpenSections((prev) => ({
                ...prev,
                behindSchedule: !prev.behindSchedule,
              }))
            }
            emptyText="No jobs are behind schedule right now."
          >
            <JobTable
              jobs={behindScheduleJobs}
              mode="behindSchedule"
              navigate={navigate}
              onOpenSchedule={openScheduleModal}
            />
          </TableShell>

          <TableShell
            title="Pending payouts"
            subtitle="Payouts created but not yet marked as paid."
            count={pendingPayouts.length}
            icon={<DollarSign className="h-4 w-4" />}
            open={openSections.pendingPayouts}
            onToggle={() =>
              setOpenSections((prev) => ({
                ...prev,
                pendingPayouts: !prev.pendingPayouts,
              }))
            }
            emptyText="No pending payouts right now."
          >
            <PayoutTable payouts={pendingPayouts} navigate={navigate} />
          </TableShell>

          <TableShell
            title="Unscheduled jobs"
            subtitle="Jobs with no Dry In, Shingles, or Punch scheduled yet."
            count={unscheduledJobs.length}
            icon={<CalendarOff className="h-4 w-4" />}
            open={openSections.unscheduled}
            onToggle={() =>
              setOpenSections((prev) => ({
                ...prev,
                unscheduled: !prev.unscheduled,
              }))
            }
            emptyText="No fully unscheduled jobs right now."
          >
            <JobTable
              jobs={unscheduledJobs}
              mode="unscheduled"
              navigate={navigate}
              onOpenSchedule={openScheduleModal}
            />
          </TableShell>

          <TableShell
            title="Jobs with no payouts"
            subtitle="Jobs that do not have mirrored payout docs or embedded job payouts."
            count={jobsWithNoPayouts.length}
            icon={<WalletCards className="h-4 w-4" />}
            open={openSections.noPayouts}
            onToggle={() =>
              setOpenSections((prev) => ({
                ...prev,
                noPayouts: !prev.noPayouts,
              }))
            }
            emptyText="Every job currently has at least one payout."
          >
            <JobTable
              jobs={jobsWithNoPayouts}
              mode="noPayouts"
              navigate={navigate}
            />
          </TableShell>
        </div>
        {scheduleModal ? (
          <ScheduleStageModal
            job={scheduleModal.job}
            stage={scheduleModal.stage}
            selectedDate={scheduleDate}
            saving={scheduleSaving}
            onDateChange={setScheduleDate}
            onClose={closeScheduleModal}
            onSave={saveScheduleDate}
          />
        ) : null}
      </motion.div>
    </div>
  );
}
