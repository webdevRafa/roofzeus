// src/pages/FinancialOverviewPage.tsx
// A comprehensive financial overview page for Roger's Roofing / ROOFZEUS.
// Upgraded to match the new dark command-center theme + Framer Motion + CountUp.

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type FieldValue,
  type Timestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import type {
  Job,
  PayoutDoc,
  MaterialExpense,
  InvoiceDoc,
  InvoiceStatus,
} from "../types/types";
import { jobConverter } from "../types/types";
import { useOrg } from "../contexts/OrgContext";
import JobDetailPage from "../pages/JobDetailPage";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import CountUp from "react-countup";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
  type TooltipItem,
} from "chart.js";
import { Line, Bar, Pie } from "react-chartjs-2";

// ------------------------------
// Theme helpers
// ------------------------------
const ease = [0.16, 1, 0.3, 1] as const;

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.06 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease },
  },
};

const cardIn: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.99, filter: "blur(10px)" },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.65, ease },
  },
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// CountUp helpers (all key numbers use CountUp)
function MoneyCount({
  cents,
  className,
  prefix = "$",
  duration = 1.1,
  decimals = 0,
}: {
  cents: number;
  className?: string;
  prefix?: string;
  duration?: number;
  decimals?: number;
}) {
  const dollars = cents / 100;
  return (
    <span className={className}>
      <CountUp
        start={0}
        end={dollars}
        duration={duration}
        prefix={prefix}
        separator=","
        decimals={decimals}
      />
    </span>
  );
}

function IntCount({
  value,
  className,
  duration = 0.9,
}: {
  value: number;
  className?: string;
  duration?: number;
}) {
  return (
    <span className={className}>
      <CountUp start={0} end={value} duration={duration} separator="," />
    </span>
  );
}

// ------------------------------
// Chart.js registration
// ------------------------------
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// Convert Firestore/Date/number/string to milliseconds
function toMillis(x: unknown): number | null {
  if (x == null) return null;
  let dt: Date | null = null;
  // Firestore timestamps have a toDate() method
  if ((x as any)?.toDate) {
    try {
      dt = (x as any).toDate() as Date;
    } catch {
      /* ignore */
    }
  } else if (x instanceof Date) {
    dt = x;
  } else if (typeof x === "string" || typeof x === "number") {
    const candidate = new Date(x);
    if (!Number.isNaN(candidate.getTime())) dt = candidate;
  }
  return dt ? dt.getTime() : null;
}

// Helper to pick a string from a record using a list of keys
function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return "";
}

// Derive a payout's employee name (normalises snapshots stored as string/object)
function payoutEmployeeName(p: PayoutDoc): string {
  const snap: any = (p as any).employeeNameSnapshot;
  if (!snap) return "";
  if (typeof snap === "string") return snap;
  if (typeof snap === "object") {
    return pickString(snap as Record<string, unknown>, [
      "name",
      "fullName",
      "displayName",
    ]);
  }
  return "";
}

// Supported time ranges for the overview page
type RangeOption = "6months" | "12months" | "ytd" | "all";

// Compute the start date corresponding to a range option
function getRangeStart(option: RangeOption): Date | null {
  const now = new Date();
  if (option === "6months")
    return new Date(now.getFullYear(), now.getMonth() - 5, 1);
  if (option === "12months")
    return new Date(now.getFullYear(), now.getMonth() - 11, 1);
  if (option === "ytd") return new Date(now.getFullYear(), 0, 1);
  return null;
}

// Format a Date to a "Jan 2025" style label
function formatMonth(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

type ReportPreset = "30d" | "90d" | "ytd" | "custom";
type ReportInvoiceMode = "sentOrPaid" | "paidOnly" | "includeDrafts";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function toInputDateValue(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function StatCard({
  title,
  subtitle,
  value,
  icon,
  tone = "default",
}: {
  title: string;
  subtitle?: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "gold" | "blue" | "green";
}) {
  const toneRing =
    tone === "gold"
      ? "ring-[rgba(207,174,93,0.22)]"
      : tone === "blue"
      ? "ring-[rgba(106,169,255,0.22)]"
      : tone === "green"
      ? "ring-[rgba(16,185,129,0.22)]"
      : "ring-white/10";

  const toneGlow =
    tone === "gold"
      ? "from-[rgba(207,174,93,0.22)]"
      : tone === "blue"
      ? "from-[rgba(106,169,255,0.22)]"
      : tone === "green"
      ? "from-[rgba(16,185,129,0.22)]"
      : "from-white/10";

  return (
    <motion.div
      variants={cardIn}
      className={cx(
        "relative overflow-hidden rounded-2xl bg-[var(--color-surface)]/25 backdrop-blur-md",
        "ring-1 shadow-sm",
        toneRing
      )}
    >
      <div
        className={cx(
          "pointer-events-none absolute -inset-24 opacity-60 blur-2xl",
          "bg-gradient-to-br",
          toneGlow,
          "to-transparent"
        )}
      />
      <div className="relative p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white/85">{title}</div>
            {subtitle ? (
              <div className="mt-0.5 text-xs text-white/55">{subtitle}</div>
            ) : null}
          </div>
          {icon ? (
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 ring-1 ring-white/10">
              {icon}
            </div>
          ) : null}
        </div>
        <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
          {value}
        </div>
      </div>
    </motion.div>
  );
}

export default function FinancialOverviewPage() {
  const { orgId, loading: orgLoading } = useOrg();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [payouts, setPayouts] = useState<PayoutDoc[]>([]);
  const [rangeOption, setRangeOption] = useState<RangeOption>("6months");

  const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);
  const [quickViewJobId, setQuickViewJobId] = useState<string | null>(null);

  const [reportPreset, setReportPreset] = useState<ReportPreset>("30d");
  const [reportMode, setReportMode] = useState<ReportInvoiceMode>("sentOrPaid");
  const [customStart, setCustomStart] = useState<string>(() =>
    toInputDateValue(new Date())
  );
  const [customEnd, setCustomEnd] = useState<string>(() =>
    toInputDateValue(new Date())
  );

  const openJobQuickView = (jobId: string) => setQuickViewJobId(jobId);
  const closeJobQuickView = () => setQuickViewJobId(null);

  // Close on ESC + lock background scroll while modal is open
  useEffect(() => {
    if (!quickViewJobId) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeJobQuickView();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [quickViewJobId]);

  // Subscribe to jobs, payouts, invoices (scoped by orgId)
  useEffect(() => {
    if (!orgId) return;

    const jobsQuery = query(
      collection(db, "jobs").withConverter(jobConverter),
      where("orgId", "==", orgId),
      orderBy("updatedAt", "desc")
    );
    const unsubJobs = onSnapshot(jobsQuery, (snap) => {
      setJobs(snap.docs.map((d) => d.data()));
    });

    const payoutsQuery = query(
      collection(db, "payouts"),
      where("orgId", "==", orgId),
      orderBy("createdAt", "desc")
    );
    const unsubPayouts = onSnapshot(payoutsQuery, (snap) => {
      setPayouts(snap.docs.map((d) => d.data() as PayoutDoc));
    });

    const invoicesQuery = query(
      collection(db, "invoices"),
      where("orgId", "==", orgId),
      orderBy("createdAt", "desc")
    );
    const unsubInvoices = onSnapshot(invoicesQuery, (snap) => {
      const list: InvoiceDoc[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<InvoiceDoc, "id">),
      }));
      setInvoices(list);
    });

    return () => {
      unsubJobs();
      unsubPayouts();
      unsubInvoices();
    };
  }, [orgId]);

  // Determine the start date for filtering
  const rangeStart = useMemo(() => getRangeStart(rangeOption), [rangeOption]);
  const now = useMemo(() => new Date(), []);

  // Filter jobs based on the selected range
  const filteredJobs = useMemo(() => {
    if (!rangeStart) return jobs;
    const startMs = rangeStart.getTime();
    return jobs.filter((job) => {
      const ms = toMillis((job as any).updatedAt ?? job.createdAt);
      return ms != null && ms >= startMs;
    });
  }, [jobs, rangeStart]);

  // Filter payouts based on the selected range
  const filteredPayouts = useMemo(() => {
    if (!rangeStart) return payouts;
    const startMs = rangeStart.getTime();
    return payouts.filter((p) => {
      const ms = toMillis(p.createdAt);
      return ms != null && ms >= startMs;
    });
  }, [payouts, rangeStart]);

  // Aggregate summary metrics
  const {
    totalEarningsCents,
    totalPayoutsCents,
    totalMaterialsCents,
    totalNetProfitCents,
    averageProfitCents,
    pendingPayoutsCents,
    paidPayoutsCents,
  } = useMemo(() => {
    let earnings = 0;
    let payoutsSum = 0;
    let materialsSum = 0;
    let netProfit = 0;

    for (const job of filteredJobs) {
      earnings += job.earnings?.totalEarningsCents ?? 0;
      payoutsSum += job.expenses?.totalPayoutsCents ?? 0;
      materialsSum += job.expenses?.totalMaterialsCents ?? 0;
      netProfit += job.computed?.netProfitCents ?? 0;
    }

    let pending = 0;
    let paid = 0;
    for (const p of filteredPayouts) {
      const amt = p.amountCents ?? 0;
      if (p.paidAt) paid += amt;
      else pending += amt;
    }

    const average =
      filteredJobs.length > 0 ? Math.round(netProfit / filteredJobs.length) : 0;

    return {
      totalEarningsCents: earnings,
      totalPayoutsCents: payoutsSum,
      totalMaterialsCents: materialsSum,
      totalNetProfitCents: netProfit,
      averageProfitCents: average,
      pendingPayoutsCents: pending,
      paidPayoutsCents: paid,
    };
  }, [filteredJobs, filteredPayouts]);

  // Monthly trend aggregation
  const {
    labels: trendLabels,
    earningsTotals,
    expenseTotals,
    netProfitTotals,
  } = useMemo(() => {
    // Determine month boundaries between rangeStart (inclusive) and now
    const months: string[] = [];
    const monthDates: Date[] = [];
    let startDate = rangeStart ? new Date(rangeStart) : null;

    // If no range start, look back up to 11 months (12 months total)
    if (!startDate) {
      startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    }

    if (startDate) {
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth();
      const endYear = now.getFullYear();
      const endMonth = now.getMonth();
      const count = (endYear - startYear) * 12 + (endMonth - startMonth);

      for (let i = 0; i <= count; i++) {
        const d = new Date(startYear, startMonth + i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          "0"
        )}`;
        months.push(key);
        monthDates.push(d);
      }
    }

    // IMPORTANT:
    // This chart MUST NOT use job.updatedAt (notes/photos edits would shift history).
    // Instead, we anchor each data point to an invoice lifecycle date:
    //   - paidAt (preferred when present)
    //   - otherwise createdAt (invoice created / sent)
    // This makes the trend reflect when revenue was actually invoiced/paid.

    const earnMap: Record<string, number> = {};
    const expMap: Record<string, number> = {};
    const netMap: Record<string, number> = {};

    months.forEach((m) => {
      earnMap[m] = 0;
      expMap[m] = 0;
      netMap[m] = 0;
    });

    // Build a quick lookup so we can attach real costs to invoice revenue.
    const jobsById = new Map<string, Job>();
    for (const j of jobs) jobsById.set(j.id, j);

    for (const inv of invoices) {
      // Prefer paidAt (recognize revenue when cash hits), fallback to createdAt.
      const basisMs = toMillis((inv as any).paidAt ?? inv.createdAt);
      if (basisMs == null) continue;

      // Align to selected range.
      if (rangeStart && basisMs < rangeStart.getTime()) continue;

      // Only count real invoices by default. Drafts should not move charts.
      const status = (inv.status ?? "draft") as InvoiceStatus;
      if (status === "draft") continue;

      const dt = new Date(basisMs);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      if (earnMap[key] == null) continue;

      const job = jobsById.get(inv.jobId);

      // --- Revenue: prefer job earnings, fallback to pricing math ---
      const earningsCents =
        (job as any)?.earnings?.totalEarningsCents ??
        (job as any)?.earnings?.entries?.totalEarningsCents ??
        (() => {
          const pricing: any = (job as any)?.pricing;
          const sqft = Number(pricing?.sqft ?? 0);
          const ratePerSqFt = Number(pricing?.ratePerSqFt ?? 0); // dollars
          const feeCents = Number(pricing?.feeCents ?? 0);
          return Math.round(sqft * ratePerSqFt * 100) + feeCents;
        })();

      // --- Expenses: prefer computed total, fallback to (payouts + materials) ---
      const costCents =
        (job as any)?.computed?.totalExpensesCents ??
        (job?.expenses?.totalPayoutsCents ?? 0) +
          (job?.expenses?.totalMaterialsCents ?? 0);

      // --- Profit: prefer computed, fallback to earnings - costs ---
      const profitCents =
        (job as any)?.computed?.netProfitCents ?? earningsCents - costCents;

      // Accumulate into the month bucket
      earnMap[key] += earningsCents;
      expMap[key] += costCents;
      netMap[key] += profitCents;
    }

    const earningsTotals = months.map((m) => earnMap[m] / 100);
    const expenseTotals = months.map((m) => expMap[m] / 100);
    const netProfitTotals = months.map((m) => netMap[m] / 100);
    const labels = monthDates.map((d) => formatMonth(d));

    return { labels, earningsTotals, expenseTotals, netProfitTotals };
  }, [invoices, jobs, rangeStart, now]);

  // Expense breakdown by category
  const { breakdownLabels, breakdownValues, breakdownColors } = useMemo(() => {
    const payoutCats: Record<string, number> = {};
    for (const p of filteredPayouts) {
      const cat = p.category ?? "other";
      payoutCats[cat] = (payoutCats[cat] || 0) + (p.amountCents ?? 0);
    }

    const materialCats: Record<string, number> = {};
    for (const job of filteredJobs) {
      const materials = job.expenses?.materials ?? [];
      for (const m of materials as MaterialExpense[]) {
        const ms = toMillis((m as any).purchasedAt ?? (m as any).createdAt);
        if (rangeStart) {
          if (ms == null || ms < rangeStart.getTime()) continue;
        }
        const cat = (m.category as string) ?? "materials";
        materialCats[cat] = (materialCats[cat] || 0) + (m.amountCents ?? 0);
      }
    }

    const labels: string[] = [];
    const values: number[] = [];
    const colors: string[] = [];

    // More “command-center” palette (gold + teal + accents)
    const palette = [
      "#cfae5d",
      "#6aa9ff",
      "#10b981",
      "#f59e0b",
      "#14b8a6",
      "#ec4899",
      "#a78bfa",
      "#f97316",
    ];
    let idx = 0;

    const pushCat = (name: string, cents: number) => {
      if (cents <= 0) return;
      labels.push(name);
      values.push(cents / 100);
      colors.push(palette[idx++ % palette.length]);
    };

    for (const [cat, cents] of Object.entries(payoutCats)) {
      const display = cat.charAt(0).toUpperCase() + cat.slice(1);
      pushCat(display + " (Payout)", cents);
    }
    for (const [cat, cents] of Object.entries(materialCats)) {
      const display = cat
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (s) => s.toUpperCase());
      pushCat(display + " (Mat.)", cents);
    }

    return {
      breakdownLabels: labels,
      breakdownValues: values,
      breakdownColors: colors,
    };
  }, [filteredPayouts, filteredJobs, rangeStart]);

  // ------------------------------
  // Invoice report helpers
  // ------------------------------
  const reportRange = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);

    if (reportPreset === "30d") {
      const start = startOfDay(new Date(today.getTime() - 29 * 86400000));
      return { start, end: endOfDay(today) };
    }
    if (reportPreset === "90d") {
      const start = startOfDay(new Date(today.getTime() - 89 * 86400000));
      return { start, end: endOfDay(today) };
    }
    if (reportPreset === "ytd") {
      const start = startOfDay(new Date(today.getFullYear(), 0, 1));
      return { start, end: endOfDay(today) };
    }

    // custom
    const s = customStart ? new Date(customStart) : today;
    const e = customEnd ? new Date(customEnd) : today;

    const start = startOfDay(s);
    const end = endOfDay(e);

    return start.getTime() <= end.getTime()
      ? { start, end }
      : { start: endOfDay(e), end: startOfDay(s) };
  }, [reportPreset, customStart, customEnd]);

  function invoiceBasisDate(inv: InvoiceDoc, mode: ReportInvoiceMode) {
    if (mode === "paidOnly") return (inv as any).paidAt;
    return (inv as any).sentAt ?? inv.createdAt;
  }

  const invoicesForReport = useMemo(() => {
    const startMs = reportRange.start.getTime();
    const endMs = reportRange.end.getTime();

    const allowedStatuses: InvoiceStatus[] =
      reportMode === "paidOnly"
        ? ["paid"]
        : reportMode === "includeDrafts"
        ? ["draft", "sent", "paid"]
        : ["sent", "paid"];

    return invoices
      .filter((inv) => allowedStatuses.includes(inv.status))
      .filter((inv) => {
        const basis = invoiceBasisDate(inv, reportMode);
        const ms = toMillis(basis as unknown as Timestamp | Date | FieldValue);
        return ms != null && ms >= startMs && ms <= endMs;
      });
  }, [invoices, reportRange, reportMode]);

  const reportSummary = useMemo(() => {
    let totalCents = 0;
    let paidCents = 0;
    let outstandingCents = 0;

    // Job lookup so report totals reflect real job revenue (not invoice cost snapshots)
    const jobsById = new Map<string, Job>();
    for (const j of jobs) jobsById.set(j.id, j);

    const invoiceRevenueCents = (inv: InvoiceDoc): number => {
      const job = jobsById.get(inv.jobId);
      if (!job) return 0;

      const earningsFromField =
        (job as any)?.earnings?.totalEarningsCents ??
        (job as any)?.earnings?.entries?.totalEarningsCents;

      if (Number.isFinite(earningsFromField)) return Number(earningsFromField);

      // Fallback: pricing math
      const pricing: any = (job as any)?.pricing;
      const sqft = Number(pricing?.sqft ?? 0);
      const ratePerSqFt = Number(pricing?.ratePerSqFt ?? 0); // dollars
      const feeCents = Number(pricing?.feeCents ?? 0);
      return Math.round(sqft * ratePerSqFt * 100) + feeCents;
    };

    for (const inv of invoicesForReport) {
      const amt = invoiceRevenueCents(inv);
      totalCents += amt;
      if (inv.status === "paid") paidCents += amt;
      else outstandingCents += amt;
    }

    return {
      invoiceCount: invoicesForReport.length,
      totalCents,
      paidCents,
      outstandingCents,
    };
  }, [invoicesForReport, jobs]);

  function invoiceJobLabel(inv: InvoiceDoc): string {
    const job = jobs.find((j) => j.id === inv.jobId);
    if (job) {
      const a: any = job.address;
      if (typeof a === "string") return a;
      if (a && typeof a === "object") return a.fullLine ?? a.line1 ?? inv.jobId;
    }
    const snap: any = (inv as any).addressSnapshot;
    if (snap && typeof snap === "object") {
      return snap.fullLine ?? snap.line1 ?? inv.jobId;
    }
    return inv.jobId;
  }

  function invoiceDateLabel(inv: InvoiceDoc, mode: ReportInvoiceMode): string {
    const basis = invoiceBasisDate(inv, mode);
    const ms = toMillis(basis as any);
    if (!ms) return "—";
    return new Date(ms).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function downloadInvoiceCSV() {
    const rows = invoicesForReport.map((inv) => ({
      number: inv.number,
      status: inv.status,
      date: invoiceDateLabel(inv, reportMode),
      job: invoiceJobLabel(inv),
      total: ((inv.money?.totalCents ?? 0) / 100).toFixed(2),
      customerName: inv.customer?.name ?? "",
      customerEmail: inv.customer?.email ?? "",
      customerPhone: inv.customer?.phone ?? "",
    }));

    const header = [
      "Invoice #",
      "Status",
      "Date",
      "Job",
      "Total",
      "Customer Name",
      "Customer Email",
      "Customer Phone",
    ];

    const csv = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.number,
          r.status,
          r.date,
          r.job,
          r.total,
          r.customerName,
          r.customerEmail,
          r.customerPhone,
        ]
          .map((cell) => {
            const v = String(cell ?? "");
            if (/[,"\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
            return v;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices-report_${toInputDateValue(
      reportRange.start
    )}_to_${toInputDateValue(reportRange.end)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ------------------------------
  // Dark chart options
  // ------------------------------
  const tickColor = "rgba(245, 246, 248, 0.65)";
  const gridColor = "rgba(58, 63, 75, 0.55)";
  const legendColor = "rgba(245, 246, 248, 0.85)";

  const profitTrendData: ChartData<"line", number[], string> = {
    labels: trendLabels,
    datasets: [
      {
        label: "Earnings ($)",
        data: earningsTotals,
        borderColor: "#6aa9ff",
        backgroundColor: "rgba(106,169,255,0.18)",
        tension: 0.28,
        pointRadius: 2,
        pointHoverRadius: 4,
      },
      {
        label: "Expenses ($)",
        data: expenseTotals,
        borderColor: "#cfae5d",
        backgroundColor: "rgba(207,174,93,0.16)",
        tension: 0.28,
        pointRadius: 2,
        pointHoverRadius: 4,
      },
      {
        label: "Net Profit ($)",
        data: netProfitTotals,
        borderColor: "#10b981",
        backgroundColor: "rgba(16,185,129,0.14)",
        tension: 0.28,
        pointRadius: 2,
        pointHoverRadius: 4,
      },
    ],
  };

  const profitTrendOptions: ChartOptions<"line"> = {
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          boxWidth: 10,
          boxHeight: 10,
          color: legendColor,
          font: { size: 11 },
        },
      },
      title: { display: false },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<"line">) => {
            const label = context.dataset.label ?? "";
            const value = context.parsed.y;
            return `${label}: $${Number(value).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: tickColor },
        grid: { color: gridColor },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: tickColor,
          callback: (value: any) => `$${value}`,
        },
        grid: { color: gridColor },
      },
    },
  };

  const expenseBreakdownData: ChartData<"pie", number[], string> = {
    labels: breakdownLabels,
    datasets: [
      {
        data: breakdownValues,
        backgroundColor: breakdownColors,
        hoverOffset: 4,
        borderColor: "rgba(15, 18, 26, 0.85)",
        borderWidth: 2,
      },
    ],
  };

  const expenseBreakdownOptions: ChartOptions<"pie"> = {
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          font: { size: 10 },
          color: legendColor,
          usePointStyle: true,
          pointStyle: "circle",
        },
      },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<"pie">) => {
            const label = context.label ?? "";
            const value = context.parsed as any;
            return `${label}: $${Number(value).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`;
          },
        },
      },
    },
  };

  const payoutByEmployee = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of filteredPayouts) {
      const name = payoutEmployeeName(p) || "Unknown";
      map[name] = (map[name] || 0) + (p.amountCents ?? 0);
    }
    const entries = Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    return {
      labels: entries.map((e) => e[0]),
      values: entries.map((e) => e[1] / 100),
    };
  }, [filteredPayouts]);

  const payoutByEmployeeData: ChartData<"bar", number[], string> = {
    labels: payoutByEmployee.labels,
    datasets: [
      {
        label: "Payouts ($)",
        data: payoutByEmployee.values,
        backgroundColor: "rgba(106,169,255,0.35)",
        borderColor: "#6aa9ff",
        borderWidth: 1,
        borderRadius: 10,
      },
    ],
  };

  const payoutByEmployeeOptions: ChartOptions<"bar"> = {
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: {
          color: legendColor,
          font: { size: 11 },
        },
      },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<"bar">) => {
            const value = context.parsed.y;
            return `$${Number(value).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: tickColor },
        grid: { color: gridColor },
      },
      y: {
        beginAtZero: true,
        ticks: { color: tickColor },
        grid: { color: gridColor },
      },
    },
  };

  // ------------------------------
  // UI
  // ------------------------------
  if (orgLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] p-4 sm:p-6">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl bg-[var(--color-surface)]/25 backdrop-blur-md ring-1 ring-white/10 p-6 text-white/70">
            Loading financial overview…
          </div>
        </div>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="min-h-[calc(100vh-64px)] p-4 sm:p-6">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl bg-[var(--color-surface)]/25 backdrop-blur-md ring-1 ring-white/10 p-6 text-white/70">
            No organization selected.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="mb-5 sm:mb-7"
        >
          <motion.div variants={fadeUp} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                  Financial Overview
                </div>
                <div className="mt-1 text-sm text-white/60">
                  Earnings, expenses, payouts, and invoicing — in one place.
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-white/60">Range</label>
                <select
                  value={rangeOption}
                  onChange={(e) =>
                    setRangeOption(e.target.value as RangeOption)
                  }
                  className={cx(
                    "rounded-xl bg-white/5 px-3 py-2 text-sm text-white",
                    "ring-1 ring-white/10 outline-none",
                    "hover:bg-white/10 focus:ring-white/20"
                  )}
                >
                  <option value="6months">Last 6 months</option>
                  <option value="12months">Last 12 months</option>
                  <option value="ytd">Year to date</option>
                  <option value="all">All time</option>
                </select>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* KPI cards */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4"
        >
          <StatCard
            title="Total Earnings"
            subtitle="From jobs in range"
            tone="blue"
            value={<MoneyCount cents={totalEarningsCents} />}
          />
          <StatCard
            title="Net Profit"
            subtitle="Earnings minus expenses"
            tone="green"
            value={<MoneyCount cents={totalNetProfitCents} />}
          />
          <StatCard
            title="Payouts"
            subtitle="Crew payouts tracked"
            tone="default"
            value={<MoneyCount cents={totalPayoutsCents} />}
          />
          <StatCard
            title="Materials"
            subtitle="Materials expenses tracked"
            tone="gold"
            value={<MoneyCount cents={totalMaterialsCents} />}
          />
        </motion.div>

        {/* Secondary KPI row */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="mt-3 sm:mt-4 grid gap-3 sm:gap-4 md:grid-cols-3"
        >
          <StatCard
            title="Avg Profit / Job"
            subtitle="Net profit divided by jobs"
            value={<MoneyCount cents={averageProfitCents} />}
          />
          <StatCard
            title="Pending Payouts"
            subtitle="Not marked as paid"
            value={<MoneyCount cents={pendingPayoutsCents} />}
          />
          <StatCard
            title="Paid Payouts"
            subtitle="Marked as paid"
            value={<MoneyCount cents={paidPayoutsCents} />}
          />
        </motion.div>

        {/* Charts */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {/* Profit trend */}
          <motion.div
            variants={cardIn}
            initial="hidden"
            animate="show"
            className="rounded-2xl bg-[var(--color-surface)]/25 backdrop-blur-md ring-1 ring-white/10 shadow-sm"
          >
            <div className="p-4 sm:p-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-white">
                    Earnings, Expenses & Profit Trend
                  </div>
                  <div className="mt-0.5 text-xs text-white/55">
                    Invoice-based trend (uses paidAt/createdAt — not updatedAt).
                  </div>
                </div>
                <div className="text-xs text-white/50">
                  {filteredJobs.length} job(s) in range
                </div>
              </div>

              <div className="mt-3 h-[280px]">
                <Line data={profitTrendData} options={profitTrendOptions} />
              </div>

              <div className="mt-2 text-[11px] text-white/45">
                Tip: use this to spot profitability dips (materials spikes,
                payout surges, or lower earnings).
              </div>
            </div>
          </motion.div>

          {/* Expense breakdown */}
          <motion.div
            variants={cardIn}
            initial="hidden"
            animate="show"
            className="rounded-2xl bg-[var(--color-surface)]/25 backdrop-blur-md ring-1 ring-white/10 shadow-sm"
          >
            <div className="p-4 sm:p-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-white">
                    Expense Breakdown
                  </div>
                  <div className="mt-0.5 text-xs text-white/55">
                    Payout categories + materials categories combined.
                  </div>
                </div>
                <div className="text-xs text-white/50">
                  {breakdownLabels.length} category(s)
                </div>
              </div>

              <div className="mt-3 h-[280px]">
                <Pie
                  data={expenseBreakdownData}
                  options={expenseBreakdownOptions}
                />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Payouts by employee */}
        <div className="mt-4">
          <motion.div
            variants={cardIn}
            initial="hidden"
            animate="show"
            className="rounded-2xl bg-[var(--color-surface)]/25 backdrop-blur-md ring-1 ring-white/10 shadow-sm"
          >
            <div className="p-4 sm:p-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-white">
                    Payouts by Employee
                  </div>
                  <div className="mt-0.5 text-xs text-white/55">
                    Top employees by payout amount (range).
                  </div>
                </div>
                <div className="text-xs text-white/50">
                  {payoutByEmployee.labels.length} shown
                </div>
              </div>

              <div className="mt-3 h-[280px]">
                <Bar
                  data={payoutByEmployeeData}
                  options={payoutByEmployeeOptions}
                />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Invoice report */}
        <div className="mt-6">
          <motion.div
            variants={cardIn}
            initial="hidden"
            animate="show"
            className="rounded-2xl bg-[var(--color-surface)]/25 backdrop-blur-md ring-1 ring-white/10 shadow-sm"
          >
            <div className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-lg font-semibold text-white">
                    Invoice Report
                  </div>
                  <div className="mt-0.5 text-xs text-white/55">
                    Filter invoices by “sent/paid” vs “paid only”, export CSV,
                    and reconcile totals.
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={reportPreset}
                    onChange={(e) =>
                      setReportPreset(e.target.value as ReportPreset)
                    }
                    className={cx(
                      "rounded-xl bg-white/5 px-3 py-2 text-sm text-white",
                      "ring-1 ring-white/10 outline-none",
                      "hover:bg-white/10 focus:ring-white/20"
                    )}
                  >
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="ytd">Year to date</option>
                    <option value="custom">Custom</option>
                  </select>

                  <select
                    value={reportMode}
                    onChange={(e) =>
                      setReportMode(e.target.value as ReportInvoiceMode)
                    }
                    className={cx(
                      "rounded-xl bg-white/5 px-3 py-2 text-sm text-white",
                      "ring-1 ring-white/10 outline-none",
                      "hover:bg-white/10 focus:ring-white/20"
                    )}
                  >
                    <option value="sentOrPaid">Sent + Paid</option>
                    <option value="paidOnly">Paid only</option>
                    <option value="includeDrafts">Include drafts</option>
                  </select>

                  {reportPreset === "custom" ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className={cx(
                          "rounded-xl bg-white/5 px-3 py-2 text-sm text-white",
                          "ring-1 ring-white/10 outline-none",
                          "hover:bg-white/10 focus:ring-white/20"
                        )}
                      />
                      <span className="text-xs text-white/50">to</span>
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className={cx(
                          "rounded-xl bg-white/5 px-3 py-2 text-sm text-white",
                          "ring-1 ring-white/10 outline-none",
                          "hover:bg-white/10 focus:ring-white/20"
                        )}
                      />
                    </div>
                  ) : null}

                  <button
                    onClick={downloadInvoiceCSV}
                    className={cx(
                      "rounded-xl bg-white/10 px-3 py-2 text-sm text-white",
                      "ring-1 ring-white/10 hover:bg-white/15"
                    )}
                  >
                    Export CSV
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
                  <div className="text-xs text-white/55">Invoices</div>
                  <div className="mt-1 text-xl font-semibold text-white">
                    <IntCount value={reportSummary.invoiceCount} />
                  </div>
                </div>

                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
                  <div className="text-xs text-white/55">Total</div>
                  <div className="mt-1 text-xl font-semibold text-white">
                    <MoneyCount cents={reportSummary.totalCents} />
                  </div>
                </div>

                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
                  <div className="text-xs text-white/55">Paid</div>
                  <div className="mt-1 text-xl font-semibold text-white">
                    <MoneyCount cents={reportSummary.paidCents} />
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[11px] text-white/55 border-b border-white/10">
                  <div className="col-span-3">Invoice</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-3">Date</div>
                  <div className="col-span-2 text-right">Total</div>
                  <div className="col-span-2 text-right">Job</div>
                </div>

                <div className="max-h-[340px] overflow-auto">
                  {invoicesForReport.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-white/55">
                      No invoices in this range.
                    </div>
                  ) : (
                    invoicesForReport.map((inv) => (
                      <button
                        key={inv.id}
                        onClick={() => openJobQuickView(inv.jobId)}
                        className={cx(
                          "w-full text-left grid grid-cols-12 gap-2 px-4 py-2",
                          "text-sm text-white/80 border-b border-white/10",
                          "hover:bg-white/5"
                        )}
                      >
                        <div className="col-span-3 font-medium">
                          {inv.number ?? inv.id.slice(0, 6)}
                        </div>
                        <div className="col-span-2 text-white/60">
                          {inv.status}
                        </div>
                        <div className="col-span-3 text-white/60">
                          {invoiceDateLabel(inv, reportMode)}
                        </div>
                        <div className="col-span-2 text-right">
                          <MoneyCount
                            cents={inv.money?.totalCents ?? 0}
                            duration={0.6}
                          />
                        </div>
                        <div className="col-span-2 text-right truncate text-white/55">
                          {invoiceJobLabel(inv)}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Job Quick View Modal */}
        <AnimatePresence>
          {quickViewJobId ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeJobQuickView();
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.99 }}
                transition={{ duration: 0.2, ease }}
                className="absolute left-1/2 top-1/2 w-[min(1100px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-[var(--color-surface)] ring-1 ring-white/10 shadow-2xl"
              >
                <div className="max-h-[88vh] overflow-auto">
                  <JobDetailPage
                    jobId={quickViewJobId}
                    variant="modal"
                    onClose={closeJobQuickView}
                  />
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
