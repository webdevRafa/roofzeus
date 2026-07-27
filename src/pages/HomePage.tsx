import { motion } from "framer-motion";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  CheckCircle2,
  FileText,
  ReceiptText,
  Users,
} from "lucide-react";
import {
  CheckList,
  Eyebrow,
  FinalCta,
  OperationsBoard,
  ProfitEquation,
  SectionHeading,
  TrialActions,
} from "../components/marketing/MarketingPrimitives";

const reveal = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.18 },
  transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const },
};

const outcomes = [
  ["Every job in one place", "Schedules, notes, photos, pricing, and progress"],
  ["Know the real profit", "Earnings, materials, payouts, and net"],
  ["Paperwork ready to send", "Invoices, pay stubs, and warranty reports"],
];

export default function HomePage() {
  return (
    <main className="rz-page">
      <section className="rz-hero">
        <div className="rz-container rz-hero__grid">
          <motion.div
            className="rz-hero__content"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          >
            <Eyebrow>Built for roofing contractors</Eyebrow>
            <h1>
              A clearer way to run your <span>roofing business.</span>
            </h1>
            <p className="rz-hero__copy">
              Roof Zeus keeps jobs, schedules, crew activity, costs, payouts,
              and documents organized from the first visit to final closeout.
            </p>
            <TrialActions />
            <div className="rz-trial-note" aria-label="Trial details">
              <span>
                <CheckCircle2 aria-hidden="true" />
                30 days free
              </span>
              <span>
                <CheckCircle2 aria-hidden="true" />
                No card required
              </span>
              <span>
                <CheckCircle2 aria-hidden="true" />
                Cancel anytime
              </span>
            </div>
          </motion.div>

          <motion.div
            className="rz-hero__visual"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.75,
              delay: 0.12,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <OperationsBoard />
          </motion.div>
        </div>
      </section>

      <div className="rz-container rz-outcome-strip">
        {outcomes.map(([title, copy]) => (
          <div key={title}>
            <strong>{title}</strong>
            <span>{copy}</span>
          </div>
        ))}
      </div>

      <section className="rz-section-band rz-section-band--paper">
        <div className="rz-container rz-page-section">
          <motion.div {...reveal}>
            <SectionHeading
              eyebrow="One operating system"
              title="Less chasing. More control."
              copy="A roofing company is hard enough to run. Roof Zeus keeps the field, office, and financial picture connected without turning your day into data entry."
            />
          </motion.div>

          <div className="rz-bento">
          <motion.article
            className="rz-bento-card rz-bento-card--wide"
            {...reveal}
          >
            <div className="rz-bento-card__visual">
              <div className="rz-mini-pipeline" aria-hidden="true">
                <div>Dry-in · Tue</div>
                <div>Shingles · Thu</div>
                <div>Punch · Ready</div>
              </div>
            </div>
            <div className="rz-bento-card__icon">
              <CalendarDays aria-hidden="true" />
            </div>
            <h3>A schedule built around how roofs actually move</h3>
            <p>
              Track dry-in, shingles, and punch stages without forcing roofing
              work into a generic calendar.
            </p>
          </motion.article>

          <motion.article className="rz-bento-card" {...reveal}>
            <div className="rz-bento-card__icon">
              <Users aria-hidden="true" />
            </div>
            <h3>Give crews exactly what they need</h3>
            <p>
              Assign work, collect job notes and photos, and keep owners in
              control of the full financial view.
            </p>
          </motion.article>

          <motion.article className="rz-bento-card" {...reveal}>
            <div className="rz-bento-card__icon">
              <BriefcaseBusiness aria-hidden="true" />
            </div>
            <h3>One source of truth per job</h3>
            <p>
              Pricing, stages, activity, materials, payouts, and documents stay
              attached to the work they belong to.
            </p>
          </motion.article>

          <motion.article
            className="rz-bento-card rz-bento-card--wide"
            {...reveal}
          >
            <div className="rz-bento-card__visual">
              <div className="rz-mini-bars" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className="rz-bento-card__icon">
              <BarChart3 aria-hidden="true" />
            </div>
            <h3>See where the money went—and what is left</h3>
            <p>
              Follow earnings, material expenses, crew payouts, and net profit
              across the date range that matters.
            </p>
          </motion.article>
          </div>
        </div>
      </section>

      <section className="rz-container">
        <motion.article className="rz-feature-split" {...reveal}>
          <div>
            <Eyebrow>Job command center</Eyebrow>
            <h3>The whole story of a job, without the scavenger hunt.</h3>
            <p>
              Open one job and see its production stages, pricing, latest
              activity, expenses, payout totals, and profit.
            </p>
            <CheckList
              items={[
                "Dry-in, shingles, and punch status",
                "Notes, photos, activity, and reports",
                "Job-level payout and material totals",
              ]}
            />
          </div>
          <div className="rz-lifecycle-board">
            <div className="rz-lifecycle-board__header">
              <span>One job / one source of truth</span>
              <span>From won to closed</span>
            </div>
            <div className="rz-lifecycle-board__steps">
              {[
                ["01", "Scheduled", "The plan is visible"],
                ["02", "In progress", "The field stays connected"],
                ["03", "Ready for punch", "The next move is clear"],
                ["04", "Closed", "Costs and records are complete"],
              ].map(([number, title, copy]) => (
                <div key={number}>
                  <span>{number}</span>
                  <strong>{title}</strong>
                  <small>{copy}</small>
                </div>
              ))}
            </div>
          </div>
        </motion.article>

        <motion.article className="rz-feature-split" {...reveal}>
          <div>
            <Eyebrow>Financial clarity</Eyebrow>
            <h3>Make decisions from the numbers, not from a hunch.</h3>
            <p>
              Choose a date range and see how revenue, payouts, materials, and
              net profit are moving together.
            </p>
            <CheckList
              items={[
                "Profit and expense trend at a glance",
                "Payout and material breakdowns",
                "Average profit per completed job",
              ]}
            />
          </div>
          <ProfitEquation />
        </motion.article>

        <motion.article className="rz-feature-split" {...reveal}>
          <div>
            <Eyebrow>Field to office</Eyebrow>
            <h3>Capture the work once. Use it everywhere.</h3>
            <p>
              Crews add updates where the job happens. The office gets the
              records it needs to pay, report, invoice, and keep moving.
            </p>
            <CheckList
              items={[
                "Photos and notes captured from the field",
                "Clean payout history and pay stubs",
                "Professional invoices and warranty reports",
              ]}
            />
          </div>
          <div className="rz-feature-grid">
            {[
              [Camera, "Field updates", "Photos and notes stay with the job."],
              [ReceiptText, "Payout records", "Track who was paid and why."],
              [FileText, "Documents", "Create professional records in less time."],
            ].map(([Icon, title, copy]) => {
              const CardIcon = Icon as typeof Camera;
              return (
                <article className="rz-feature-card" key={title as string}>
                  <div className="rz-feature-card__icon">
                    <CardIcon aria-hidden="true" />
                  </div>
                  <h3>{title as string}</h3>
                  <p>{copy as string}</p>
                </article>
              );
            })}
          </div>
        </motion.article>
      </section>

      <FinalCta />
    </main>
  );
}
