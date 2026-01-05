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
import { useTheme } from "../../theme/ThemeProvider";

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
type RgbTuple = [number, number, number];

function readRgbVar(varName: string, fallback: RgbTuple): RgbTuple {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();

  const parts = raw
    .split(/\s+/)
    .map((p) => Number(p))
    .filter((n) => Number.isFinite(n));

  if (parts.length >= 3) {
    return [parts[0], parts[1], parts[2]];
  }

  return fallback;
}

function rgba(rgb: RgbTuple, a: number) {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
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

  const { theme } = useTheme();

  // Theme tokens (canvas colors must be explicit strings)
  const chartTokens = useMemo(() => {
    const textRgb = readRgbVar("--color-text-rgb", [238, 242, 247]);
    const borderRgb = readRgbVar("--color-border-rgb", [58, 63, 75]);
    const bgRgb = readRgbVar("--color-background-rgb", [11, 14, 20]);
    const primaryRgb = readRgbVar("--color-primary-rgb", [207, 174, 93]);

    const GOLD = `rgb(${primaryRgb[0]},${primaryRgb[1]},${primaryRgb[2]})`;
    const BLUE = "#6aa9ff";

    const GRID = rgba(borderRgb, theme === "light" ? 0.14 : 0.1);
    const TICK = rgba(textRgb, theme === "light" ? 0.55 : 0.6);
    const LEGEND = rgba(textRgb, theme === "light" ? 0.65 : 0.7);

    const TOOLTIP_BG =
      theme === "light" ? "rgba(255,255,255,0.98)" : rgba(bgRgb, 0.92);

    const TOOLTIP_BORDER = rgba(borderRgb, theme === "light" ? 0.22 : 0.18);

    const TOOLTIP_TITLE = rgba(textRgb, 0.92);
    const TOOLTIP_BODY = rgba(textRgb, 0.85);

    const POINT_BORDER =
      theme === "light" ? "rgba(255,255,255,0.90)" : rgba(bgRgb, 0.75);

    return {
      GOLD,
      BLUE,
      GRID,
      TICK,
      LEGEND,
      TOOLTIP_BG,
      TOOLTIP_BORDER,
      TOOLTIP_TITLE,
      TOOLTIP_BODY,
      POINT_BORDER,
      FILL_GOLD: rgba(primaryRgb, theme === "light" ? 0.14 : 0.18),
      FILL_BLUE:
        theme === "light" ? "rgba(106,169,255,0.10)" : "rgba(106,169,255,0.14)",
    };
  }, [theme]);

  // ✅ Strongly-type chart data so TS doesn't widen literals
  const chartData: ChartData<"line", number[], string> = {
    labels,
    datasets: [
      {
        label: "Net Profit ($)",
        data: netProfits,
        borderColor: chartTokens.GOLD,
        backgroundColor: chartTokens.FILL_GOLD,
        pointBackgroundColor: chartTokens.GOLD,
        pointBorderColor: chartTokens.POINT_BORDER,

        pointBorderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 4,
        tension: 0.32,
      },
      {
        label: "Payouts ($)",
        data: payoutTotals,
        borderColor: chartTokens.BLUE,
        backgroundColor: chartTokens.FILL_BLUE,
        pointBackgroundColor: chartTokens.BLUE,
        pointBorderColor: chartTokens.POINT_BORDER,
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
          color: chartTokens.LEGEND,
        },
      },
      title: { display: false },
      tooltip: {
        backgroundColor: chartTokens.TOOLTIP_BG,
        borderColor: chartTokens.TOOLTIP_BORDER,
        titleColor: chartTokens.TOOLTIP_TITLE,
        bodyColor: chartTokens.TOOLTIP_BODY,
        borderWidth: 1,
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
        grid: { color: chartTokens.GRID },
        ticks: { color: chartTokens.TICK, font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: chartTokens.GRID },
        ticks: {
          color: chartTokens.TICK,
          callback: (value) => `$${value}`,
          font: { size: 11 },
        },
      },
    },
  };

  return (
    <section className="mb-40 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] hover:shadow-md overflow-hidden">
      {/* Header (matches the new command-center sections) */}
      <div className="relative px-4 sm:px-6 py-4 border-b border-[var(--color-border)]">
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div
                className="h-9 w-9 rounded-xl border flex items-center justify-center"
                style={{
                  backgroundColor: "var(--panel-bg)",
                  borderColor: "rgb(var(--color-border-rgb) / 0.22)",
                }}
              >
                <TrendingUp
                  className="h-5 w-5"
                  style={{ color: "var(--color-primary)" }}
                />
              </div>

              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-semibold text-[var(--color-text)]">
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
            borderColor: "rgb(var(--color-border-rgb) / 0.22)",
            backgroundColor: "var(--panel-bg)",
          }}
        >
          <div className="absolute inset-0 p-3 sm:p-4">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>

        <div className="mt-3 text-[12px] text-[rgb(var(--color-text-rgb)/0.55)]">
          Tip: if payouts rise faster than net profit, drill into jobs to check
          material spend, rates, or unexpected labor.
        </div>
      </div>
    </section>
  );
}
