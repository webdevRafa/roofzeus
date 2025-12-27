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

export default function FinancialOverviewPage() {
  const { orgId, loading: orgLoading } = useOrg();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [payouts, setPayouts] = useState<PayoutDoc[]>([]);
  const [rangeOption, setRangeOption] = useState<RangeOption>("6months");

  const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);
  const [quickViewJobId, setQuickViewJobId] = useState<string | null>(null);

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

    const earnMap: Record<string, number> = {};
    const expMap: Record<string, number> = {};
    const netMap: Record<string, number> = {};

    months.forEach((m) => {
      earnMap[m] = 0;
      expMap[m] = 0;
      netMap[m] = 0;
    });

    for (const invoice of invoices) {
      if (invoice.status === "void" || invoice.status === "draft") continue;

      const ms = toMillis(invoiceTrendDate(invoice));
      if (ms == null) continue;

      const dt = new Date(ms);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
        2,
        "0"
      )}`;

      if (earnMap[key] != null) {
        const earningsCents = invoice.money?.totalCents ?? 0;
        const expensesCents =
          (invoice.money?.materialsCents ?? 0) +
          (invoice.money?.laborCents ?? 0) +
          (invoice.money?.extraCents ?? 0);

        earnMap[key] += earningsCents;
        expMap[key] += expensesCents;
        netMap[key] += earningsCents - expensesCents;
      }
    }

    const earningsTotals = months.map((m) => earnMap[m] / 100);
    const expenseTotals = months.map((m) => expMap[m] / 100);
    const netProfitTotals = months.map((m) => netMap[m] / 100);
    const labels = monthDates.map((d) => formatMonth(d));

    return { labels, earningsTotals, expenseTotals, netProfitTotals };
  }, [invoices, rangeStart, now]);

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

  // Top jobs by net profit (keep jobId so we can open JobDetailPage modal)
  const { topJobsList, topJobLabels, topJobValues } = useMemo(() => {
    const list = filteredJobs
      .map((j) => {
        const profit = j.computed?.netProfitCents ?? 0;

        const label = (() => {
          const addr: any = j.address;
          if (typeof addr === "string") return addr;
          if (typeof addr === "object") {
            return (
              (addr.fullLine as string) ||
              (addr.line1 as string) ||
              `${addr.city ?? ""}, ${addr.state ?? ""}`
            );
          }
          return j.id;
        })();

        return { jobId: j.id, label, profit };
      })
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);

    return {
      topJobsList: list,
      topJobLabels: list.map((x) => x.label),
      topJobValues: list.map((x) => x.profit / 100),
    };
  }, [filteredJobs]);

  // Top employees by total payout
  const { topEmployeeLabels, topEmployeeValues } = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const p of filteredPayouts) {
      const name = payoutEmployeeName(p) || "Unknown";
      totals[name] = (totals[name] || 0) + (p.amountCents ?? 0);
    }

    const list = Object.entries(totals)
      .map(([name, cents]) => ({ name, cents }))
      .sort((a, b) => b.cents - a.cents)
      .slice(0, 5);

    return {
      topEmployeeLabels: list.map((x) => x.name),
      topEmployeeValues: list.map((x) => x.cents / 100),
    };
  }, [filteredPayouts]);

  // ------------------------------
  // Financial Reporting (Invoice-based)
  // ------------------------------
  type ReportPreset = "week" | "month" | "year" | "custom";
  type ReportInvoiceMode = "sentPaid" | "paidOnly" | "includeDrafts";

  function startOfDay(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  }
  function endOfDay(d: Date) {
    return new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      23,
      59,
      59,
      999
    );
  }
  function toInputDateValue(d: Date) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  function parseInputDateValue(v: string): Date | null {
    if (!v) return null;
    const d = new Date(`${v}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const [reportPreset, setReportPreset] = useState<ReportPreset>("month");
  const [reportMode, setReportMode] = useState<ReportInvoiceMode>("sentPaid");

  // default custom range (last 30 days)
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return toInputDateValue(d);
  });
  const [customEnd, setCustomEnd] = useState<string>(() =>
    toInputDateValue(new Date())
  );

  const reportRange = useMemo(() => {
    const now = new Date();

    if (reportPreset === "week") {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      return { start: startOfDay(start), end: endOfDay(now) };
    }
    if (reportPreset === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOfDay(start), end: endOfDay(now) };
    }
    if (reportPreset === "year") {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start: startOfDay(start), end: endOfDay(now) };
    }

    // custom
    const s =
      parseInputDateValue(customStart) ??
      new Date(now.getFullYear(), now.getMonth(), 1);
    const e = parseInputDateValue(customEnd) ?? now;
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

  function invoiceTrendDate(inv: InvoiceDoc): InvoiceDoc["createdAt"] {
    if (inv.status === "paid") {
      return inv.paidAt ?? inv.sentAt ?? inv.createdAt;
    }
    return inv.sentAt ?? inv.createdAt;
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

    for (const inv of invoicesForReport) {
      const amt = inv.money?.totalCents ?? 0;
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
  }, [invoicesForReport]);

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
            const value = context.parsed;
            return `${label}: $${Number(value).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`;
          },
        },
      },
    },
  };

  const topJobsData: ChartData<"bar", number[], string> = {
    labels: topJobLabels,
    datasets: [
      {
        label: "Net Profit ($)",
        data: topJobValues,
        backgroundColor: "rgba(207,174,93,0.85)",
        borderColor: "rgba(207,174,93,1)",
        borderWidth: 1,
        borderRadius: 10,
      },
    ],
  };

  const topJobsOptions: ChartOptions<"bar"> = {
    indexAxis: "y",
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<"bar">) => {
            const value = context.parsed.x;
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
        beginAtZero: true,
        ticks: { color: tickColor },
        grid: { color: gridColor },
      },
      y: {
        ticks: { color: tickColor },
        grid: { display: false },
      },
    },
  };

  const topEmployeesData: ChartData<"bar", number[], string> = {
    labels: topEmployeeLabels,
    datasets: [
      {
        label: "Total Payout ($)",
        data: topEmployeeValues,
        backgroundColor: "rgba(106,169,255,0.85)",
        borderColor: "rgba(106,169,255,1)",
        borderWidth: 1,
        borderRadius: 10,
      },
    ],
  };

  const topEmployeesOptions: ChartOptions<"bar"> = {
    indexAxis: "y",
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<"bar">) => {
            const value = context.parsed.x;
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
        beginAtZero: true,
        ticks: { color: tickColor },
        grid: { color: gridColor },
      },
      y: {
        ticks: { color: tickColor },
        grid: { display: false },
      },
    },
  };

  // ------------------------------
  // Guard states
  // ------------------------------
  if (orgLoading) {
    return (
      <div className="p-6 text-[var(--color-muted)]">
        Loading financial overview…
      </div>
    );
  }
  if (!orgId) {
    return (
      <div className="p-8 text-red-300">
        You are not linked to an organization. Please contact your admin.
      </div>
    );
  }

  const StatCard = ({
    label,
    children,
    hint,
  }: {
    label: string;
    children: React.ReactNode;
    hint?: string;
  }) => (
    <motion.div
      variants={cardIn}
      className={cx(
        "rounded-2xl border border-white/10 bg-[var(--color-card)] shadow-[0_20px_60px_rgba(0,0,0,0.35)]",
        "p-4 hover:bg-[var(--color-card-hover)] transition-colors"
      )}
    >
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
        {label}
      </div>
      <div className="mt-1 text-xl sm:text-2xl font-semibold text-[var(--color-text)]">
        {children}
      </div>
      {hint ? (
        <div className="mt-1 text-xs text-[var(--color-muted)]">{hint}</div>
      ) : null}
    </motion.div>
  );

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={stagger}
      className="mx-auto w-full py-6 sm:py-10 md:px-4"
    >
      {/* Page header */}
      <motion.div variants={fadeUp} className="mb-6 flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm text-[var(--color-muted)]">
              Financial Overview
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--color-text)]">
              Profit, expenses, payouts, and reporting
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Use the range filter to review trends and performance. Drill into
              jobs from the top lists or from invoice reporting.
            </p>
          </div>

          {/* Range selector */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { label: "Last 6 months", value: "6months" },
                { label: "Last 12 months", value: "12months" },
                { label: "Year to date", value: "ytd" },
                { label: "All time", value: "all" },
              ] as { label: string; value: RangeOption }[]
            ).map((opt) => {
              const active = rangeOption === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setRangeOption(opt.value)}
                  className={cx(
                    "rounded-full px-3 py-1 text-xs border transition",
                    active
                      ? "bg-[var(--color-accent-gold)] text-black border-transparent"
                      : "bg-[var(--color-card)] text-[var(--color-text)] border-white/10 hover:bg-[var(--color-card-hover)]"
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Summary */}
      <motion.section variants={fadeUp} className="mb-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-8">
          <StatCard label="Total earnings">
            <MoneyCount cents={totalEarningsCents} decimals={0} />
          </StatCard>

          <StatCard label="Net profit">
            <MoneyCount cents={totalNetProfitCents} decimals={0} />
          </StatCard>

          <StatCard
            label="Avg profit / job"
            hint={`${filteredJobs.length} job(s) in range`}
          >
            <MoneyCount cents={averageProfitCents} decimals={0} />
          </StatCard>

          <StatCard label="Materials">
            <MoneyCount cents={totalMaterialsCents} decimals={0} />
          </StatCard>

          <StatCard label="Total payouts">
            <MoneyCount cents={totalPayoutsCents} decimals={0} />
          </StatCard>

          <StatCard label="Paid payouts">
            <MoneyCount cents={paidPayoutsCents} decimals={0} />
          </StatCard>

          <StatCard label="Pending payouts">
            <MoneyCount cents={pendingPayoutsCents} decimals={0} />
          </StatCard>
        </div>
      </motion.section>

      {/* Trend chart */}
      <motion.section
        variants={fadeUp}
        className="rounded-2xl border border-white/10 bg-[var(--color-card)] p-4 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] hover:bg-[var(--color-card-hover)] transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-text)]">
              Earnings, Expenses &amp; Profit Trend
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Invoice-based trend (paid date for paid invoices, otherwise sent
              or created date).
            </p>
          </div>
        </div>

        <div className="mt-4 relative h-80 w-full">
          <Line data={profitTrendData} options={profitTrendOptions} />
        </div>

        <div className="mt-3 text-xs text-[var(--color-muted)]">
          Tip: use this to spot profitability dips (materials spikes, payout
          surges, or lower earnings).
        </div>
      </motion.section>

      {/* Financial Reporting (Invoice-based) */}
      <motion.section variants={fadeUp} className="mt-6">
        <div className="rounded-2xl border border-white/10 bg-[var(--color-card)] p-4 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] hover:bg-[var(--color-card-hover)] transition-colors">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-text)]">
                Financial Reporting
              </h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Invoice-based reporting (uses invoice dates). Great for
                real-world accounting.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={downloadInvoiceCSV}
                className={cx(
                  "rounded-full px-3 py-1 text-xs border transition",
                  "bg-[var(--color-card)] text-[var(--color-text)] border-white/10 hover:bg-[var(--color-card-hover)]"
                )}
              >
                Download CSV
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
            {/* Presets */}
            <div className="lg:col-span-7">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-[var(--color-text)]">
                  Range:
                </span>

                {(
                  [
                    { label: "Week", value: "week" },
                    { label: "Month", value: "month" },
                    { label: "Year", value: "year" },
                    { label: "Custom", value: "custom" },
                  ] as { label: string; value: ReportPreset }[]
                ).map((opt) => {
                  const active = reportPreset === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setReportPreset(opt.value)}
                      className={cx(
                        "rounded-full px-3 py-1 text-xs border transition",
                        active
                          ? "bg-[var(--color-accent-gold)] text-black border-transparent"
                          : "bg-[var(--color-card)] text-[var(--color-text)] border-white/10 hover:bg-[var(--color-card-hover)]"
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Custom date inputs */}
              {reportPreset === "custom" && (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                      Start
                    </label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className={cx(
                        "mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none",
                        "border-white/10 bg-[var(--color-surface)] text-[var(--color-text)]",
                        "focus:ring-2 focus:ring-[var(--color-accent-gold)]"
                      )}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                      End
                    </label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className={cx(
                        "mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none",
                        "border-white/10 bg-[var(--color-surface)] text-[var(--color-text)]",
                        "focus:ring-2 focus:ring-[var(--color-accent-gold)]"
                      )}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Invoice status mode */}
            <div className="lg:col-span-5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-[var(--color-text)]">
                  Invoices:
                </span>

                {(
                  [
                    { label: "Issued", value: "sentPaid" },
                    { label: "Paid only", value: "paidOnly" },
                    { label: "Include drafts", value: "includeDrafts" },
                  ] as { label: string; value: ReportInvoiceMode }[]
                ).map((opt) => {
                  const active = reportMode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setReportMode(opt.value)}
                      className={cx(
                        "rounded-full px-3 py-1 text-xs border transition",
                        active
                          ? "bg-[var(--color-accent-gold)] text-black border-transparent"
                          : "bg-[var(--color-card)] text-[var(--color-text)] border-white/10 hover:bg-[var(--color-card-hover)]"
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 text-[11px] text-[var(--color-muted)]">
                Reporting window:{" "}
                <span className="font-semibold text-[var(--color-text)]">
                  {reportRange.start.toLocaleDateString()} –{" "}
                  {reportRange.end.toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Summary row */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-[var(--color-surface)] p-4">
              <div className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
                Invoiced revenue
              </div>
              <div className="mt-1 text-xl font-semibold text-[var(--color-text)]">
                <MoneyCount cents={reportSummary.totalCents} decimals={0} />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[var(--color-surface)] p-4">
              <div className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
                Paid
              </div>
              <div className="mt-1 text-xl font-semibold text-[var(--color-text)]">
                <MoneyCount cents={reportSummary.paidCents} decimals={0} />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[var(--color-surface)] p-4">
              <div className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
                Outstanding
              </div>
              <div className="mt-1 text-xl font-semibold text-[var(--color-text)]">
                <MoneyCount
                  cents={reportSummary.outstandingCents}
                  decimals={0}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[var(--color-surface)] p-4">
              <div className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
                Invoices
              </div>
              <div className="mt-1 text-xl font-semibold text-[var(--color-text)]">
                <IntCount value={reportSummary.invoiceCount} />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10 bg-[var(--color-surface)] section-scroll-invoices">
            <table className="min-w-full text-sm">
              <thead className="bg-black/15 text-[11px] uppercase tracking-wide text-[var(--color-muted)] sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">Invoice</th>
                  <th className="px-3 py-2 text-left">Job</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>

              <tbody>
                {invoicesForReport.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-[var(--color-muted)]"
                    >
                      No invoices found in this range.
                    </td>
                  </tr>
                ) : (
                  invoicesForReport.slice(0, 50).map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-t border-white/10 hover:bg-white/5"
                    >
                      <td className="px-3 py-2">
                        <div className="font-semibold text-[var(--color-text)]">
                          {inv.number}
                        </div>
                        {inv.customer?.name && (
                          <div className="text-[11px] text-[var(--color-muted)]">
                            {inv.customer.name}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => openJobQuickView(inv.jobId)}
                          className="font-medium text-[var(--color-text)] hover:underline text-left"
                          title="Quick view job"
                        >
                          {invoiceJobLabel(inv)}
                        </button>
                      </td>

                      <td className="px-3 py-2 text-[var(--color-muted)]">
                        {invoiceDateLabel(inv, reportMode)}
                      </td>

                      <td className="px-3 py-2">
                        <span
                          className={cx(
                            "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium border",
                            inv.status === "paid"
                              ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/25"
                              : inv.status === "sent"
                              ? "bg-amber-500/15 text-amber-200 border-amber-500/25"
                              : inv.status === "draft"
                              ? "bg-white/10 text-[var(--color-muted)] border-white/10"
                              : "bg-rose-500/15 text-rose-200 border-rose-500/25"
                          )}
                        >
                          {inv.status}
                        </span>
                      </td>

                      <td className="px-3 py-2 text-right font-semibold text-[var(--color-text)]">
                        {/* CountUp for row totals (short duration to stay snappy) */}
                        <MoneyCount
                          cents={inv.money?.totalCents ?? 0}
                          decimals={0}
                          duration={0.45}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {invoicesForReport.length > 50 && (
              <div className="px-3 py-2 text-[11px] text-[var(--color-muted)]">
                Showing first 50 invoices. Download CSV for full export.
              </div>
            )}
          </div>
        </div>
      </motion.section>

      {/* 3-up charts row */}
      <motion.div
        variants={fadeUp}
        className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3"
      >
        <div className="rounded-2xl border border-white/10 bg-[var(--color-card)] p-4 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] hover:bg-[var(--color-card-hover)] transition-colors">
          <h2 className="text-xl font-semibold text-[var(--color-text)]">
            Expense Breakdown
          </h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Categories include payouts + materials.
          </p>
          <div className="mt-4 relative h-64 w-full">
            {breakdownValues.length > 0 ? (
              <Pie
                data={expenseBreakdownData}
                options={expenseBreakdownOptions}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-[var(--color-muted)]">
                No expenses in selected range
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[var(--color-card)] p-4 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] hover:bg-[var(--color-card-hover)] transition-colors">
          <h2 className="text-xl font-semibold text-[var(--color-text)]">
            Top Jobs by Profit
          </h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Click a job to quick-view details.
          </p>

          <div className="mt-4 relative h-64 w-full">
            {topJobLabels.length > 0 ? (
              <Bar data={topJobsData} options={topJobsOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-[var(--color-muted)]">
                No jobs in selected range
              </div>
            )}
          </div>

          {topJobsList.length > 0 && (
            <div className="mt-4 space-y-1">
              {topJobsList.map((j) => (
                <button
                  key={j.jobId}
                  type="button"
                  onClick={() => openJobQuickView(j.jobId)}
                  className="w-full text-left text-sm px-2 py-1.5 rounded-xl hover:bg-white/5 transition"
                  title="Quick view job"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-[var(--color-text)] hover:underline">
                      {j.label}
                    </span>
                    <span className="shrink-0 text-[11px] text-[var(--color-muted)]">
                      {/* CountUp for list values */}
                      <MoneyCount
                        cents={j.profit}
                        decimals={0}
                        duration={0.5}
                      />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-[var(--color-card)] p-4 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] hover:bg-[var(--color-card-hover)] transition-colors">
          <h2 className="text-xl font-semibold text-[var(--color-text)]">
            Top Employees by Payout
          </h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Total payouts by employee (range).
          </p>

          <div className="mt-4 relative h-64 w-full">
            {topEmployeeLabels.length > 0 ? (
              <Bar data={topEmployeesData} options={topEmployeesOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-[var(--color-muted)]">
                No payouts in selected range
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Quick Job View Modal */}
      <AnimatePresence>
        {quickViewJobId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.18 } }}
            exit={{ opacity: 0, transition: { duration: 0.16 } }}
            className="fixed inset-0 z-[200] bg-black/70 p-3 sm:p-6 flex items-center justify-center"
            onMouseDown={(e) => {
              // click outside closes
              if (e.target === e.currentTarget) closeJobQuickView();
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.99 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                transition: { duration: 0.28, ease },
              }}
              exit={{
                opacity: 0,
                y: 10,
                scale: 0.99,
                transition: { duration: 0.18, ease },
              }}
              className="w-full max-w-[1200px] h-[92vh] overflow-hidden rounded-2xl bg-[var(--color-surface)] shadow-2xl border border-white/10"
            >
              <div className="h-full overflow-y-auto">
                <JobDetailPage
                  jobId={quickViewJobId}
                  variant="modal"
                  onClose={closeJobQuickView}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
