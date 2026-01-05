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
  materialProgressJobs,
  readyForPunchJobs,
  payouts,
}: DashboardSummarySectionProps) {
  const totalJobs = jobs.length;

  const pendingJobs = jobs.filter((j) => j.status === "pending").length;
  const completedJobs = jobs.filter((j) => j.status === "completed").length;

  const pendingPayouts = payouts.filter((p) => !p.paidAt).length;
  const paidPayouts = payouts.filter((p) => !!p.paidAt).length;

  return (
    <section className="mb-6 px-2">
      {/* Optional little header row to match the “Command Center” vibe */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--color-text)]">
            Overview
          </div>
          <div className="text-[12px] text-[var(--color-accent-gold)]/70">
            Jobs • Pipeline • Payouts
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <span className="rounded-full border border-[var(--color-accent-gold)]/30 bg-[var(--color-accent-gold)]/10 px-3 py-1 text-[11px] text-[var(--color-accent-gold)]">
            Live
          </span>
        </div>
      </div>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
      >
        <KpiCard
          label="Total Jobs"
          value={totalJobs}
          sub="All jobs in scope"
          accent="neutral"
        />
        <KpiCard
          label="Pending Completion"
          value={pendingJobs}
          sub="Awaiting final status"
          accent="gold"
        />
        <KpiCard
          label="Scheduled / In Progress"
          value={materialProgressJobs.length}
          sub="Felt or shingles stage"
          accent="sky"
        />
        <KpiCard
          label="Ready for Punch"
          value={readyForPunchJobs.length}
          sub="Materials done"
          accent="emerald"
        />
        <KpiCard
          label="Completed"
          value={completedJobs}
          sub="Finished jobs"
          accent="emerald"
        />
        <KpiCard
          label="Pending Payouts"
          value={pendingPayouts}
          sub={`Paid: ${paidPayouts}`}
          accent="gold"
        />
      </motion.div>
    </section>
  );
}
