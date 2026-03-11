// src/features/dashboard/DashboardSummarySection.tsx
import type { Job, PayoutDoc } from "../../types/types";
import { motion, type Variants } from "framer-motion";
import CountUp from "react-countup";

interface DashboardSummarySectionProps {
  jobs: Job[];
  materialProgressJobs: Job[];
  readyForPunchJobs: Job[];
  payouts: PayoutDoc[];
}

const ease = [0.16, 1, 0.3, 1] as const;

const stagger: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.03 },
  },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.55, ease },
  },
};

function StatInt({ value }: { value: number }) {
  return <CountUp start={0} end={value} duration={0.9} separator="," />;
}

function KpiCard({
  label,
  value,
  sub,
  accent = "neutral",
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: "neutral" | "gold" | "sky" | "emerald";
}) {
  const accentClasses =
    accent === "gold"
      ? "text-[var(--kpi-value)]"
      : accent === "sky"
      ? "text-[var(--kpi-value)]"
      : accent === "emerald"
      ? "text-[var(--kpi-value)]"
      : "text-[var(--kpi-value)]";

  const subClasses = "text-[rgb(var(--color-text-rgb)/0.62)]";

  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -2, transition: { duration: 0.22, ease } }}
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] hover:bg-[var(--color-card-hover)] p-4 hover:shadow-md select-none  "
    >
      <div className="text-[14px] uppercase tracking-wide text-[rgb(var(--color-text-rgb)]">
        {label}
      </div>

      <div className={`mt-1 text-xl font-semibold ${accentClasses}`}>
        <StatInt value={value} />
      </div>

      {sub ? (
        <div className={`mt-1 text-[12px] ${subClasses}`}>{sub}</div>
      ) : null}
    </motion.div>
  );
}

export default function DashboardSummarySection({
  jobs,
  payouts,
}: DashboardSummarySectionProps) {
  const pendingJobs = jobs.filter((j) => j.status === "pending").length;

  const pendingPayouts = payouts.filter((p) => !p.paidAt).length;
  return (
    <section className="mb-6 px-2">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
      >
        <KpiCard
          label="Jobs Pending Completion"
          value={pendingJobs}
          accent="gold"
        />

        <KpiCard label="Pending Payouts" value={pendingPayouts} accent="gold" />
      </motion.div>
    </section>
  );
}
