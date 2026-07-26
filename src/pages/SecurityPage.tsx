import {
  ClipboardCheck,
  Database,
  FileDown,
  KeyRound,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  Eyebrow,
  FinalCta,
  SectionHeading,
  TrialActions,
} from "../components/marketing/MarketingPrimitives";

const trustCards = [
  {
    icon: Database,
    title: "Company-scoped workspaces",
    copy: "Jobs, photos, records, and financials are organized around organization membership.",
    bullets: [
      "Organization membership gates access",
      "Company records stay in their workspace",
      "Structured for multi-company operations",
    ],
  },
  {
    icon: Users,
    title: "Role-aware team access",
    copy: "Owners control the broader operation while crew members focus on assigned work.",
    bullets: [
      "Owner, admin, manager, and crew contexts",
      "Assigned job workflows for crews",
      "Financial visibility stays intentional",
    ],
  },
  {
    icon: KeyRound,
    title: "Individual sign-in",
    copy: "Each team member uses an individual account instead of passing shared credentials around.",
    bullets: [
      "One identity per team member",
      "Email verification in the signup flow",
      "Session-based authenticated access",
    ],
  },
  {
    icon: ClipboardCheck,
    title: "Audit-friendly records",
    copy: "Job activity, payouts, stubs, notes, and documents stay organized for later review.",
    bullets: [
      "Payout history remains attributable",
      "Job documentation stays in context",
      "Records are easier to reconcile",
    ],
  },
  {
    icon: FileDown,
    title: "Portable documents",
    copy: "Professional reports and records help keep important operational information usable.",
    bullets: [
      "Print-ready business documents",
      "Structured records for reporting",
      "Clearer handoff outside the app",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Practical access design",
    copy: "Security is part of the workflow, not another complicated system crews have to learn.",
    bullets: [
      "Clear team boundaries",
      "Organization isolation first",
      "Access follows the work role",
    ],
  },
];

export default function SecurityPage() {
  return (
    <main className="rz-page">
      <section className="rz-page-hero rz-container">
        <Eyebrow>Trust by design</Eyebrow>
        <h1>
          Owners keep control.
          <br />
          <span>Crews keep moving.</span>
        </h1>
        <p>
          Roofing operations include pricing, profit, payouts, addresses, and
          field documentation. Roof Zeus uses company workspaces, individual
          accounts, and role-aware access to keep that information organized.
        </p>
        <TrialActions
          secondaryTo="/privacy"
          secondaryLabel="Read our privacy policy"
        />
      </section>

      <section className="rz-container rz-page-section--tight">
        <SectionHeading
          eyebrow="How access works"
          title="The right information for the right person."
          copy="The owner needs the whole financial picture. A crew member needs the assigned roof, its schedule, and a simple way to add updates."
        />
        <div className="rz-trust-grid">
          {trustCards.map(({ icon: Icon, title, copy, bullets }) => (
            <article className="rz-trust-card" key={title}>
              <div className="rz-trust-card__icon">
                <Icon aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
              <ul>
                {bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <FinalCta
        title="A clearer system is a more controlled system."
        copy="Try the complete Roof Zeus workspace for 30 days with no card required."
      />
    </main>
  );
}
