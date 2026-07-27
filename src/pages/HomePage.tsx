import { motion } from "framer-motion";
import {
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  Users,
} from "lucide-react";
import {
  CheckList,
  DocumentsBoard,
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
  ["Jobs", "Pricing, costs, progress, and records"],
  ["People", "Optional assignments and focused access"],
  ["Money", "Payouts, profit, and reports"],
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
            <Eyebrow>Roofing operations, simplified</Eyebrow>
            <h1>Run every roofing job with less guesswork.</h1>
            <p className="rz-hero__copy">
              Keep pricing, expenses, payouts, crews, and job documents
              organized in one place.
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
              eyebrow="What Roof Zeus does"
              title="The essentials stay connected."
              copy="A simple system for the work, money, people, and paperwork behind every roof."
            />
          </motion.div>

          <div className="rz-bento">
            {[
              [
                BriefcaseBusiness,
                "Complete job records",
                "Pricing, costs, activity, invoices, and warranties stay together.",
              ],
              [
                Users,
                "Optional crew access",
                "Assign work when needed. Workers only see what helps them do it.",
              ],
              [
                BarChart3,
                "Financial clarity",
                "See expenses, payouts, materials, revenue, and profit.",
              ],
              [
                FileText,
                "Easy documents",
                "Create invoices, warranty packets, pay stubs, and reports.",
              ],
            ].map(([Icon, title, copy]) => {
              const CardIcon = Icon as typeof BriefcaseBusiness;
              return (
                <motion.article
                  className="rz-bento-card"
                  {...reveal}
                  key={title as string}
                >
                  <div className="rz-bento-card__icon">
                    <CardIcon aria-hidden="true" />
                  </div>
                  <h3>{title as string}</h3>
                  <p>{copy as string}</p>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rz-container">
        <motion.article className="rz-feature-split" {...reveal}>
          <div>
            <Eyebrow>Job records</Eyebrow>
            <h3>One job. One complete history.</h3>
            <p>
              Pricing, expenses, payouts, activity, invoices, and warranties
              remain tied to the property.
            </p>
            <CheckList
              items={[
                "See the full financial picture",
                "Reopen historical records anytime",
                "Assign a worker only when needed",
              ]}
            />
          </div>
          <div className="rz-lifecycle-board">
            <div className="rz-lifecycle-board__header">
              <span>One job record</span>
              <span>From start to history</span>
            </div>
            <div className="rz-lifecycle-board__steps">
              {[
                ["01", "Add the job", "Enter pricing and scope"],
                ["02", "Track the work", "Record costs and payouts"],
                ["03", "Create documents", "Invoice and warranty"],
                ["04", "Keep the record", "Nothing gets separated"],
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
            <Eyebrow>Financial reporting</Eyebrow>
            <h3>Know the business. Simplify tax time.</h3>
            <p>
              Every recorded cost and payout rolls into a financial view you
              can filter and report on.
            </p>
            <CheckList
              items={[
                "Expenses, materials, payouts, and profit",
                "Charts and date-range breakdowns",
                "Reports ready when tax season arrives",
              ]}
            />
          </div>
          <ProfitEquation />
        </motion.article>

        <motion.article className="rz-feature-split" {...reveal}>
          <div>
            <Eyebrow>Professional documents</Eyebrow>
            <h3>Paperwork that is easy to create and easy to find.</h3>
            <p>
              Create invoices, warranty packets, and pay stubs from records
              already inside Roof Zeus.
            </p>
            <CheckList
              items={[
                "Invoices stay with the job",
                "Warranty packets stay with the job",
                "Pay stubs stay with payout history",
              ]}
            />
          </div>
          <DocumentsBoard />
        </motion.article>
      </section>

      <FinalCta />
    </main>
  );
}
