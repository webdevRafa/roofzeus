import {
  BarChart3,
  CalendarDays,
  Camera,
  FileText,
  HardHat,
  ReceiptText,
  ShieldCheck,
  Users,
} from "lucide-react";
import financialOverview from "../assets/financial-overview.png";
import productDemo from "../assets/roofzeus-demo.png";
import {
  CheckList,
  Eyebrow,
  FinalCta,
  ProductFrame,
  SectionHeading,
  TrialActions,
} from "../components/marketing/MarketingPrimitives";

const features = [
  {
    icon: HardHat,
    title: "Job pages that hold the truth",
    copy: "Keep stages, pricing, notes, photos, activity, payouts, materials, and profit connected to the job.",
    highlight: true,
  },
  {
    icon: CalendarDays,
    title: "Roofing-stage scheduling",
    copy: "Plan dry-in, shingles, and punch work in a production view that matches the way roofs move.",
  },
  {
    icon: Users,
    title: "Crew access without chaos",
    copy: "Assign jobs, collect field updates, and keep sensitive owner-level information appropriately limited.",
  },
  {
    icon: BarChart3,
    title: "Profit clarity by date range",
    copy: "See earnings, expenses, payout totals, materials, average job profit, and the trend over time.",
    highlight: true,
  },
  {
    icon: ReceiptText,
    title: "Payouts that stay explainable",
    copy: "Keep a clean history of who was paid, what the payment covered, and when it happened.",
  },
  {
    icon: Camera,
    title: "Photos and notes in context",
    copy: "Capture field updates where the work lives instead of searching camera rolls and text threads.",
  },
  {
    icon: FileText,
    title: "Professional documents",
    copy: "Create invoices, job reports, warranty reports, and pay stubs from the records already in the system.",
  },
  {
    icon: ShieldCheck,
    title: "Organization-aware access",
    copy: "Company workspaces and team roles help keep the right people inside the right operational context.",
  },
];

export default function FeaturesPage() {
  return (
    <main className="rz-page">
      <section className="rz-page-hero rz-container">
        <Eyebrow>Roofing operations, connected</Eyebrow>
        <h1>
          The field, the office, and the numbers—<span>finally in sync.</span>
        </h1>
        <p>
          Roof Zeus is built around the real path from scheduled roof to
          completed job, paid crew, accurate profit, and finished paperwork.
        </p>
        <TrialActions />
      </section>

      <section className="rz-container rz-page-section--tight">
        <SectionHeading
          eyebrow="The complete toolkit"
          title="Everything important stays close to the job."
          copy="Fewer disconnected tools means less duplicate entry, fewer missing updates, and a much clearer picture of the operation."
          align="center"
        />
        <div className="rz-feature-grid">
          {features.map(({ icon: Icon, title, copy, highlight }) => (
            <article
              className={`rz-feature-card ${
                highlight ? "rz-feature-card--highlight" : ""
              }`}
              key={title}
            >
              <div className="rz-feature-card__icon">
                <Icon aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rz-container rz-page-section">
        <article className="rz-feature-split">
          <div>
            <Eyebrow>Production view</Eyebrow>
            <h3>See what is moving, what is ready, and what needs attention.</h3>
            <p>
              Keep the active job list and roof-stage schedule visible without
              building a separate spreadsheet every morning.
            </p>
            <CheckList
              items={[
                "Search and filter the entire job list",
                "See dry-in and shingles schedules together",
                "Move completed work into punch readiness",
              ]}
            />
          </div>
          <ProductFrame
            src={productDemo}
            alt="Roof Zeus job list and roof production schedule"
          />
        </article>

        <article className="rz-feature-split">
          <div>
            <Eyebrow>Owner view</Eyebrow>
            <h3>Understand the business behind the roofs.</h3>
            <p>
              Turn job records into a useful financial picture with income,
              crew costs, material costs, and net profit in one view.
            </p>
            <CheckList
              items={[
                "Choose the reporting period that matters",
                "See earnings, expenses, and net profit together",
                "Spot payout or material changes before they become surprises",
              ]}
            />
          </div>
          <ProductFrame
            src={financialOverview}
            alt="Roof Zeus financial overview dashboard"
          />
        </article>
      </section>

      <FinalCta
        title="Run the roofing workflow in one place."
        copy="Start with all features included for 30 days. No card required."
      />
    </main>
  );
}
