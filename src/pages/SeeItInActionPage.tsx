import { motion } from "framer-motion";
import { Camera, CircleDollarSign, ClipboardCheck } from "lucide-react";
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

const steps = [
  {
    icon: ClipboardCheck,
    title: "Add the job",
    copy: "Enter the property, pricing, and work details.",
  },
  {
    icon: Camera,
    title: "Track the work",
    copy: "Record progress, expenses, payouts, and optional assignments.",
  },
  {
    icon: CircleDollarSign,
    title: "Close it cleanly",
    copy: "See the profit and create the invoice and warranty packet.",
  },
];

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.18 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
};

export default function SeeItInActionPage() {
  return (
    <main className="rz-page">
      <motion.section className="rz-page-hero rz-container" {...reveal}>
        <Eyebrow>See the workflow</Eyebrow>
        <h1>From new job to clean closeout.</h1>
        <p>
          The work, money, people, and documents move through one record.
        </p>
        <TrialActions
          secondaryTo="/features"
          secondaryLabel="Explore every feature"
        />
      </motion.section>

      <section className="rz-container rz-page-section--tight">
        <motion.div {...reveal}>
          <OperationsBoard />
        </motion.div>
      </section>

      <section className="rz-container rz-page-section">
        <motion.div {...reveal}>
          <SectionHeading
            eyebrow="A simple workflow"
            title="Three steps. One complete record."
            align="center"
          />
        </motion.div>
        <div className="rz-walkthrough-grid">
          {steps.map(({ icon: Icon, title, copy }, index) => (
            <motion.article
              className="rz-walkthrough-card"
              key={title}
              {...reveal}
            >
              <div className="rz-walkthrough-card__number">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="rz-feature-card__icon" style={{ marginTop: 28 }}>
                <Icon aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="rz-container">
        <motion.article className="rz-feature-split" {...reveal}>
          <div>
            <Eyebrow>Closeout</Eyebrow>
            <h3>Finish the job with professional documents.</h3>
            <p>
              Create the invoice and warranty packet, then leave both attached
              to the historical job.
            </p>
            <CheckList
              items={[
                "Invoice ready to send",
                "Warranty packet ready for the customer",
                "Payout records and pay stubs kept together",
              ]}
            />
          </div>
          <DocumentsBoard />
        </motion.article>

        <motion.article className="rz-feature-split" {...reveal}>
          <div>
            <Eyebrow>Reporting</Eyebrow>
            <h3>Every finished job improves the financial picture.</h3>
            <p>
              Revenue, expenses, payouts, materials, and profit roll into clear
              reports for any date range.
            </p>
          </div>
          <ProfitEquation />
        </motion.article>
      </section>

      <FinalCta
        title="Try the workflow on your next job."
        copy="Start free for 30 days. No payment method required."
      />
    </main>
  );
}
