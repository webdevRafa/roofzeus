import type { Job, PayoutDoc } from "../../types/types";
import { motion, type Variants } from "framer-motion";
import CountUp from "react-countup";
import { useDashboardSummaryMetrics } from "../../hooks/useDashboardSummaryMetrics";

interface DashboardSummarySectionProps {
  jobs: Job[];
  /**
   * Jobs currently in material progress (felt/shingles scheduled or done).
   * Not used directly in this component but preserved for backwards
   * compatibility with existing callers.
   */
  materialProgressJobs?: Job[];
  /**
   * Jobs ready for punch.  Also unused here but accepted to avoid
   * breaking props passed from DashboardPage.
   */
  readyForPunchJobs?: Job[];
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
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: "neutral" | "gold" | "sky" | "emerald";
}) {
  const subClasses = "text-[rgb(var(--color-text-rgb)/0.62)]";

  return (
    <motion.div
      variants={fadeUp}
      className={`bg-[var(--color-card)] hover:bg-[var(--color-card-hover)] p-4 hover:shadow-md select-none w-full `}
    >
      <div
        className={`text-sm md:text-md text-center uppercase tracking-wide text-[var(--color-text)] `}
      >
        {label}
      </div>

      <div
        className={`text-center mt-1 text-xl font-semibold  ${
          value === 0
            ? "text-[var(--color-text)]/50"
            : "text-[var(--color-text)]"
        } `}
      >
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

  // Compute additional summary metrics (unscheduled jobs and jobs without payouts)
  const { unscheduledJobsCount, jobsWithoutPayoutsCount } =
    useDashboardSummaryMetrics(jobs, payouts);

  return (
    <section className="mb-6 px-2 mt-10">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        /*
         * Adjust the column count to accommodate four KPIs.  On small screens
         * default to two columns, then switch to two columns on small, four
         * columns on medium, and up to six on extra‑large screens.  Feel free
         * to tweak these breakpoints to better fit your design.
         */
        className="grid grid-cols-2 md:flex md:flex-row md:justify-center gap-3 "
      >
        <KpiCard
          label="Jobs Pending Completion"
          value={pendingJobs}
          accent="gold"
        />
        <KpiCard label="Pending Payouts" value={pendingPayouts} accent="gold" />
        <KpiCard
          label="Unscheduled Jobs"
          value={unscheduledJobsCount}
          accent="gold"
        />
        <KpiCard
          label="Jobs With No Payouts"
          value={jobsWithoutPayoutsCount}
          accent="gold"
        />
      </motion.div>
    </section>
  );
}
