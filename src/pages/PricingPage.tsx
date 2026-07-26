import { useState } from "react";
import { ArrowRight, CalendarDays, FileText, LineChart, Users } from "lucide-react";
import { Link } from "react-router-dom";
import {
  CheckList,
  Eyebrow,
  FinalCta,
  SectionHeading,
} from "../components/marketing/MarketingPrimitives";

const included = [
  "Unlimited jobs, notes, photos, and documents",
  "Dry-in, shingles, and punch scheduling",
  "Crew invitations and job assignments",
  "Job-level payouts, materials, and profit",
  "Invoices, pay stubs, and warranty reports",
  "Financial overview and date-range reporting",
];

const featureGroups = [
  {
    icon: CalendarDays,
    title: "Job operations",
    copy: "Jobs, production stages, schedules, notes, photos, and reports.",
  },
  {
    icon: Users,
    title: "Crew workflow",
    copy: "Assigned work, field updates, payout records, and pay stubs.",
  },
  {
    icon: LineChart,
    title: "Financial clarity",
    copy: "Earnings, expenses, payouts, materials, and profit by date range.",
  },
  {
    icon: FileText,
    title: "Professional records",
    copy: "Invoices, warranty reports, pay stubs, and job documentation.",
  },
];

export default function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const annual = billing === "annual";

  return (
    <main className="rz-page">
      <section className="rz-container rz-page-section">
        <div className="rz-pricing-layout">
          <div className="rz-pricing-intro">
            <Eyebrow>Simple, honest pricing</Eyebrow>
            <h1>
              One plan.
              <br />
              <span>Every feature.</span>
            </h1>
            <p>
              No feature maze and no card required to try it. Start with the
              full Roof Zeus experience, then choose monthly or annual billing
              when your trial ends.
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
                ? "About $42/month — save $100 each year."
                : "Flat-rate access to the complete platform."}
            </div>

            <Link className="rz-button rz-button--primary" to="/signup">
              Start 30 days free
              <ArrowRight aria-hidden="true" />
            </Link>

            <CheckList items={included} />
            <p className="rz-price-card__fine-print">
              No payment method is required to begin. After 30 days, add payment
              details to keep using your workspace.
            </p>
          </article>
        </div>
      </section>

      <section className="rz-container rz-page-section--tight">
        <SectionHeading
          eyebrow="Everything included"
          title="The tools a roofing operation needs to stay clear."
          copy="Roof Zeus connects the work happening on the roof with the decisions happening in the office."
        />
        <div className="rz-price-features">
          {featureGroups.map(({ icon: Icon, title, copy }) => (
            <article key={title}>
              <Icon aria-hidden="true" />
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rz-container rz-page-section--tight">
        <div className="rz-final-cta__inner">
          <div>
            <Eyebrow>Questions before you start?</Eyebrow>
            <h2>Get the straight answers.</h2>
            <p>
              Learn how the trial, crew access, mobile workflow, scheduling, and
              cancellations work.
            </p>
          </div>
          <div className="rz-actions">
            <Link className="rz-button rz-button--secondary" to="/faq">
              Read the FAQ
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <FinalCta
        title="One month to see what a clearer roofing operation feels like."
        copy="Every feature is included during your trial. No card required."
      />
    </main>
  );
}
