import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CalendarDays, FileText, LineChart, Users } from "lucide-react";
import { Link } from "react-router-dom";
import {
  CheckList,
  Eyebrow,
  FinalCta,
  SectionHeading,
} from "../components/marketing/MarketingPrimitives";

const included = [
  "Complete job records",
  "Optional crew assignments",
  "Pricing, expenses, payouts, and profit",
  "Invoices and warranty packets",
  "Payout history and pay stubs",
  "Financial reports and charts",
];

const featureGroups = [
  {
    icon: CalendarDays,
    title: "Jobs",
    copy: "Pricing, costs, progress, people, and history.",
  },
  {
    icon: Users,
    title: "Crew",
    copy: "Optional assignments and focused worker access.",
  },
  {
    icon: LineChart,
    title: "Finances",
    copy: "Expenses, payouts, materials, profit, and reports.",
  },
  {
    icon: FileText,
    title: "Documents",
    copy: "Invoices, warranty packets, reports, and pay stubs.",
  },
];

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.16 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
};

export default function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const annual = billing === "annual";

  return (
    <main className="rz-page">
      <section className="rz-container rz-page-section">
        <motion.div className="rz-pricing-layout" {...reveal}>
          <div className="rz-pricing-intro">
            <Eyebrow>Simple pricing</Eyebrow>
            <h1>One plan. Every core tool.</h1>
            <p>
              Use the complete platform free for 30 days. Choose monthly or
              annual billing only if you keep it.
            </p>
            <div className="rz-trial-note">
              <span>30-day free trial</span>
              <span>Cancel anytime</span>
              <span>No setup fees</span>
            </div>
          </div>

          <article className="rz-price-card">
            <div className="rz-price-card__header">
              <strong>Roof Zeus Complete</strong>
              <div
                className="rz-billing-toggle"
                role="group"
                aria-label="Billing frequency"
              >
                <button
                  type="button"
                  aria-pressed={!annual}
                  onClick={() => setBilling("monthly")}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  aria-pressed={annual}
                  onClick={() => setBilling("annual")}
                >
                  Annual
                </button>
              </div>
            </div>

            <div className="rz-price-card__price" aria-live="polite">
              <strong>{annual ? "$500" : "$50"}</strong>
              <span>{annual ? "per year" : "per month"}</span>
            </div>
            <div className="rz-price-card__saving">
              {annual
                ? "About $42/month. Save $100 each year."
                : "Flat-rate access to the complete platform."}
            </div>

            <Link className="rz-button rz-button--primary" to="/signup">
              Start 30 days free
              <ArrowRight aria-hidden="true" />
            </Link>

            <CheckList items={included} />
            <p className="rz-price-card__fine-print">
              No payment method is required to begin.
            </p>
          </article>
        </motion.div>
      </section>

      <section className="rz-container rz-page-section--tight">
        <motion.div {...reveal}>
          <SectionHeading
            eyebrow="Everything included"
            title="The whole workflow is covered."
          />
        </motion.div>
        <div className="rz-price-features">
          {featureGroups.map(({ icon: Icon, title, copy }) => (
            <motion.article key={title} {...reveal}>
              <Icon aria-hidden="true" />
              <h3>{title}</h3>
              <p>{copy}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <FinalCta
        title="See if Roof Zeus fits your business."
        copy="Try every feature for 30 days. No card required."
      />
    </main>
  );
}
