import { motion } from "framer-motion";
import {
  BarChart3,
  FileText,
  HardHat,
  ReceiptText,
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

const features = [
  {
    icon: HardHat,
    title: "Job records",
    copy: "Keep pricing, costs, activity, and documents together.",
    highlight: true,
  },
  {
    icon: Users,
    title: "Crew access",
    copy: "Assign work when useful. Keep access focused.",
  },
  {
    icon: BarChart3,
    title: "Financial reporting",
    copy: "Understand expenses, payouts, materials, revenue, and profit.",
    highlight: true,
  },
  {
    icon: ReceiptText,
    title: "Payouts and pay stubs",
    copy: "Keep worker payments recorded and easy to explain.",
  },
  {
    icon: FileText,
    title: "Invoices and warranties",
    copy: "Create professional documents that remain with the job.",
  },
];

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.18 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
};

export default function FeaturesPage() {
  return (
    <main className="rz-page">
      <motion.section className="rz-page-hero rz-container" {...reveal}>
        <Eyebrow>Roofing operations, connected</Eyebrow>
        <h1>Jobs, money, crews, and documents. Together.</h1>
        <p>
          Manage the job, understand the money, and create the paperwork.
        </p>
        <TrialActions />
      </motion.section>

      <section className="rz-container rz-page-section--tight">
        <motion.div {...reveal}>
          <SectionHeading
            eyebrow="The complete toolkit"
            title="Five tools. One clear workflow."
            align="center"
          />
        </motion.div>
        <div className="rz-feature-grid">
          {features.map(({ icon: Icon, title, copy, highlight }) => (
            <motion.article
              className={`rz-feature-card ${
                highlight ? "rz-feature-card--highlight" : ""
              }`}
              key={title}
              {...reveal}
            >
              <div className="rz-feature-card__icon">
                <Icon aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="rz-container rz-page-section">
        <motion.article className="rz-feature-split" {...reveal}>
          <div>
            <Eyebrow>Every job</Eyebrow>
            <h3>The complete record stays in one place.</h3>
            <p>
              Open a job and find the work, pricing, costs, people, and
              documents that belong to it.
            </p>
            <CheckList
              items={[
                "Pricing, materials, labor, and payouts",
                "Optional worker assignments",
                "Invoices and warranties attached",
              ]}
            />
          </div>
          <OperationsBoard />
        </motion.article>

        <motion.article className="rz-feature-split" {...reveal}>
          <div>
            <Eyebrow>Professional documents</Eyebrow>
            <h3>Create it once. Find it from the job.</h3>
            <p>
              Send polished paperwork without rebuilding information that Roof
              Zeus already knows.
            </p>
            <CheckList items={["Invoices", "Warranty packets", "Pay stubs"]} />
          </div>
          <DocumentsBoard />
        </motion.article>

        <motion.article className="rz-feature-split" {...reveal}>
          <div>
            <Eyebrow>Financial reports</Eyebrow>
            <h3>Clear numbers all year. Easier taxes later.</h3>
            <p>
              Filter the period you need and see the totals behind every
              recorded job.
            </p>
            <CheckList
              items={[
                "Expenses, payouts, materials, and profit",
                "Charts and date-range reports",
                "Cleaner records for tax season",
              ]}
            />
          </div>
          <ProfitEquation />
        </motion.article>
      </section>

      <FinalCta
        title="Start with one real job."
        copy="Every feature is included for 30 days. No card required."
      />
    </main>
  );
}
