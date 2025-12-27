// src/features/dashboard/DashboardFinancialOverviewSection.tsx
import { useMemo } from "react";
import type { Job, PayoutDoc } from "../../types/types";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
  type TooltipItem,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { Link } from "react-router-dom";
import { TrendingUp } from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Convert Firestore/Date/number/string to milliseconds (UNCHANGED)
function toMillis(x: unknown): number | null {
  if (x == null) return null;
  let dt: Date | null = null;

  if ((x as any)?.toDate) {
    try {
      dt = (x as any).toDate() as Date;
    } catch {
      // ignore
    }
  } else if (x instanceof Date) {
    dt = x;
  } else if (typeof x === "string" || typeof x === "number") {
    const candidate = new Date(x);
    if (!Number.isNaN(candidate.getTime())) dt = candidate;
  }

  return dt ? dt.getTime() : null;
}

// Format a month like “Jan 2025” (UNCHANGED)
function formatMonth(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

interface Props {
  jobs: Job[];
  payouts: PayoutDoc[];
}

/** Renders a dual-line chart summarising net profit vs total payouts */
export default function DashboardFinancialOverviewSection({
  jobs,
  payouts,
}: Props) {
  // Aggregate data for the past six months (UNCHANGED)
  const { labels, netProfits, payoutTotals } = useMemo(() => {
    const now = new Date();
    const months: string[] = [];
    const monthDates: Date[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      months.push(key);
      monthDates.push(d);
    }

    const netMap: Record<string, number> = {};
    const payoutMap: Record<string, number> = {};
    months.forEach((m) => {
      netMap[m] = 0;
      payoutMap[m] = 0;
    });

    // Sum job net profit by month (using updatedAt or createdAt)
    jobs.forEach((job) => {
      const ms = toMillis(job.updatedAt ?? job.createdAt);
      if (ms == null) return;
      const dt = new Date(ms);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
        2,
        "0"
      )}`;

      const net = job.computed?.netProfitCents ?? 0;
      if (netMap[key] != null) netMap[key] += net;
    });

    // Sum payouts by month (using createdAt)
    payouts.forEach((p) => {
      const ms = toMillis(p.createdAt);
      if (ms == null) return;
      const dt = new Date(ms);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
        2,
        "0"
      )}`;

      const amt = p.amountCents ?? 0;
      if (payoutMap[key] != null) payoutMap[key] += amt;
    });

    const labels = monthDates.map(formatMonth);
    const netProfits = months.map((m) => netMap[m] / 100); // dollars
    const payoutTotals = months.map((m) => payoutMap[m] / 100); // dollars

    return { labels, netProfits, payoutTotals };
  }, [jobs, payouts]);

  // Theme tokens (canvas colors must be explicit strings)
  const GOLD = "#cfae5d";
  const BLUE = "#6aa9ff";
  const GRID = "rgba(245,246,248,0.10)";
  const TICK = "rgba(245,246,248,0.60)";
  const LEGEND = "rgba(245,246,248,0.70)";
  const TOOLTIP_BG = "rgba(11,14,20,0.92)";
  const TOOLTIP_BORDER = "rgba(58,63,75,0.85)";

  // ✅ Strongly-type chart data so TS doesn't widen literals
  const chartData: ChartData<"line", number[], string> = {
    labels,
    datasets: [
      {
        label: "Net Profit ($)",
        data: netProfits,
        borderColor: GOLD,
        backgroundColor: "rgba(207,174,93,0.18)",
        pointBackgroundColor: GOLD,
        pointBorderColor: "rgba(11,14,20,0.75)",
        pointBorderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 4,
        tension: 0.32,
      },
      {
        label: "Payouts ($)",
        data: payoutTotals,
        borderColor: BLUE,
        backgroundColor: "rgba(106,169,255,0.14)",
        pointBackgroundColor: BLUE,
        pointBorderColor: "rgba(11,14,20,0.75)",
        pointBorderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 4,
        tension: 0.32,
      },
    ],
  };

  // ✅ Strongly-type chart options; legend.position stays a literal union ("top")
  const chartOptions: ChartOptions<"line"> = {
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          boxWidth: 10,
          boxHeight: 10,
          padding: 14,
          font: { size: 12 },
          color: LEGEND,
        },
      },
      title: { display: false },
      tooltip: {
        backgroundColor: TOOLTIP_BG,
        borderColor: TOOLTIP_BORDER,
        borderWidth: 1,
        titleColor: "rgba(245,246,248,0.92)",
        bodyColor: "rgba(245,246,248,0.85)",
        displayColors: true,
        padding: 10,
        callbacks: {
          label: (context: TooltipItem<"line">) => {
            const label = context.dataset.label ?? "";
            const value = context.parsed.y;
            return `${label}: $${Number(value).toFixed(2)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: GRID },
        ticks: { color: TICK, font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: GRID },
        ticks: {
          color: TICK,
          callback: (value) => `$${value}`,
          font: { size: 11 },
        },
      },
    },
  };

  return (
    <section className="mt-10 mb-40 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-[0_18px_50px_rgba(0,0,0,0.35)] overflow-hidden">
      {/* Header (matches the new command-center sections) */}
      <div
        className="relative px-4 sm:px-6 py-4 border-b"
        style={{ borderColor: "rgba(58,63,75,0.75)" }}
      >
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div
                className="h-9 w-9 rounded-xl border flex items-center justify-center"
                style={{
                  backgroundColor: "rgba(11,14,20,0.55)",
                  borderColor: "rgba(58,63,75,0.9)",
                }}
              >
                <TrendingUp
                  className="h-5 w-5"
                  style={{ color: "var(--color-accent-gold)" }}
                />
              </div>

              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-semibold text-white">
                  <Link
                    to="/financial-overview"
                    className="hover:underline underline-offset-4"
                  >
                    FINANCIAL OVERVIEW
                  </Link>
                </h2>

                <p
                  className="mt-1 text-xs"
                  style={{ color: "var(--color-muted)" }}
                >
                  Net profit vs total payouts over the last six months — use
                  this to spot trends and keep margins under control.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart body */}
      <div className="px-4 sm:px-6 py-4">
        <div
          className="relative h-72 w-full rounded-2xl border"
          style={{
            borderColor: "rgba(58,63,75,0.75)",
            backgroundColor: "rgba(11,14,20,0.35)",
          }}
        >
          <div className="absolute inset-0 p-3 sm:p-4">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>

        <div
          className="mt-3 text-[12px]"
          style={{ color: "rgba(245,246,248,0.55)" }}
        >
          Tip: if payouts rise faster than net profit, drill into jobs to check
          material spend, rates, or unexpected labor.
        </div>
      </div>
    </section>
  );
}
