import { motion } from "framer-motion";
import {
  ClipboardCheck,
  Database,
  KeyRound,
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
    title: "Company workspace",
    copy: "Jobs, records, and financials stay inside the company account.",
  },
  {
    icon: Users,
    title: "Focused worker access",
    copy: "Workers focus on assigned jobs without the owner's full financial view.",
  },
  {
    icon: KeyRound,
    title: "Individual accounts",
    copy: "Each person signs in with their own verified account.",
  },
  {
    icon: ClipboardCheck,
    title: "Organized history",
    copy: "Payouts, documents, and job activity remain available for review.",
  },
];

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.16 },
  transition: { duration: 0.48, ease: [0.16, 1, 0.3, 1] as const },
};

export default function SecurityPage() {
  return (
    <main className="rz-page">
      <motion.section className="rz-page-hero rz-container" {...reveal}>
        <Eyebrow>Trust by design</Eyebrow>
        <h1>Owners stay in control. Workers stay focused.</h1>
        <p>
          Company workspaces and role-aware access keep sensitive information
          intentional.
        </p>
        <TrialActions
          secondaryTo="/privacy"
          secondaryLabel="Read our privacy policy"
        />
      </motion.section>

      <section className="rz-container rz-page-section--tight">
        <motion.div {...reveal}>
          <SectionHeading
            eyebrow="How access works"
            title="The right information for the right person."
          />
        </motion.div>
        <div className="rz-trust-grid">
          {trustCards.map(({ icon: Icon, title, copy }) => (
            <motion.article
              className="rz-trust-card"
              key={title}
              {...reveal}
            >
              <div className="rz-trust-card__icon">
                <Icon aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <FinalCta
        title="Keep the business view where it belongs."
        copy="Try the complete workspace free for 30 days."
      />
    </main>
  );
}
