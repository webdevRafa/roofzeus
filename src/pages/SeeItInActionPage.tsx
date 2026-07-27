import { Camera, CircleDollarSign, ClipboardCheck } from "lucide-react";
import {
  CheckList,
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
    title: "Set up the job",
    copy: "Add the property, pricing, important details, and production stages so the team starts from one record.",
  },
  {
    icon: Camera,
    title: "Move the work forward",
    copy: "Schedule dry-in, shingles, and punch, assign the crew, and collect notes and photos from the field.",
  },
  {
    icon: CircleDollarSign,
    title: "Close with clarity",
    copy: "Record materials and payouts, understand the profit, then create the documents the office needs.",
  },
];

export default function SeeItInActionPage() {
  return (
    <main className="rz-page">
      <section className="rz-page-hero rz-container">
        <Eyebrow>See the workflow</Eyebrow>
        <h1>
          From new roof to final numbers, <span>nothing gets lost.</span>
        </h1>
        <p>
          Roof Zeus keeps production, field updates, costs, crew pay, and
          paperwork moving through one connected job record.
        </p>
        <TrialActions
          secondaryTo="/features"
          secondaryLabel="Explore every feature"
        />
      </section>

      <section className="rz-container rz-page-section--tight">
        <OperationsBoard />
      </section>

      <section className="rz-container rz-page-section">
        <SectionHeading
          eyebrow="A simpler daily rhythm"
          title="Three moves from work won to work understood."
          copy="The workflow stays simple for crews in the field while giving owners a much better operational and financial view."
          align="center"
        />
        <div className="rz-walkthrough-grid">
          {steps.map(({ icon: Icon, title, copy }, index) => (
            <article className="rz-walkthrough-card" key={title}>
              <div className="rz-walkthrough-card__number">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="rz-feature-card__icon" style={{ marginTop: 28 }}>
                <Icon aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rz-container">
        <article className="rz-feature-split">
          <div>
            <Eyebrow>One job, one story</Eyebrow>
            <h3>Production status and profit belong on the same page.</h3>
            <p>
              The operational story and financial story stop living in
              different tools, giving owners a faster way to understand what
              happened.
            </p>
            <CheckList
              items={[
                "Roofing stages and last activity",
                "Job pricing, payouts, materials, and profit",
                "Reports and warranty actions close at hand",
              ]}
            />
          </div>
          <ProfitEquation />
        </article>
      </section>

      <FinalCta
        title="Put your next roof through a clearer system."
        copy="Start with the full platform for 30 days. No payment method required."
      />
    </main>
  );
}
