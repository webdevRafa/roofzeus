// src/pages/TermsPage.tsx
import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, FileText } from "lucide-react";

const ease = [0.16, 1, 0.3, 1] as const;

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.06 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease },
  },
};

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#3a3f4b] bg-[#0b0e14]/55 px-2.5 py-1 text-[11px] text-[#cfae5d]/80">
      {children}
    </span>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#3a3f4b] bg-[#1f2430]/55 p-6">
      <div className="text-lg font-bold">{title}</div>
      <div className="mt-2 text-sm text-white/65 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

export default function TermsPage() {
  const lastUpdated = "December 28, 2025";

  return (
    <main className="min-h-[calc(100vh-64px)] text-[#f5f6f8] overflow-x-hidden">
      <section className="max-w-7xl mx-auto px-6 pt-14 pb-10">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          <motion.div
            variants={fadeUp}
            className="flex flex-wrap items-center gap-3"
          >
            <Pill>Terms</Pill>
            <Pill>Straightforward</Pill>
            <Pill>Contractor-focused</Pill>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]"
          >
            Terms of Service
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="max-w-2xl text-white/70 leading-relaxed"
          >
            These terms cover how ROOFZEUS is provided, what you can expect from
            the service, and what we expect from users operating inside a
            company workspace.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex flex-col sm:flex-row gap-3"
          >
            <Link
              to="/see-it-in-action"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#cfae5d] px-5 py-3 text-sm font-semibold text-black hover:bg-[#cfae5d]/90 transition"
            >
              Start free trial
              <ArrowRight className="h-4 w-4" />
            </Link>

            <div className="inline-flex items-center gap-2 rounded-xl border border-[#3a3f4b] bg-[#0b0e14]/35 px-5 py-3 text-sm text-white/70">
              <FileText className="h-4 w-4 text-[#cfae5d]" />
              Last updated:{" "}
              <span className="text-white/80 font-semibold">{lastUpdated}</span>
            </div>
          </motion.div>
        </motion.div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-14">
        <div className="grid gap-4">
          <Section title="Using ROOFZEUS">
            ROOFZEUS is provided as a subscription service to help roofing
            contractors manage jobs, schedules, team workflows, documentation,
            and financial records. By creating an account or using the platform,
            you agree to operate responsibly within your organization workspace.
          </Section>

          <Section title="Accounts, organizations, and roles">
            You are responsible for maintaining the confidentiality of your
            login credentials. If you invite team members, you are responsible
            for assigning roles appropriately. Role-based access helps keep
            sensitive information controlled (for example, crew access limited
            to assigned jobs and updates).
          </Section>

          <Section title="Customer data and ownership">
            You own the operational data you put into ROOFZEUS (job records,
            photos, notes, payout records, pay stubs, documents). We process
            that data only to provide and improve the service, maintain
            security, and support billing and support operations.
          </Section>

          <Section title="Acceptable use">
            You agree not to misuse the platform, attempt to access data outside
            your organization, or disrupt service operation. You also agree not
            to upload malicious content or use ROOFZEUS for unlawful purposes.
          </Section>

          <Section title="Trial and subscription">
            ROOFZEUS may offer a free trial period (currently 14 days) with no
            payment method required upfront. After the trial, continued use
            requires an active subscription. Pricing, billing frequency, and
            plan details are shown on the Pricing page.
          </Section>

          <Section title="Cancellations">
            You can cancel your subscription at any time. If you cancel during a
            paid billing period, you will generally retain access through the
            end of that period. (Specific billing behavior may depend on the
            payment processor and plan type.)
          </Section>

          <Section title="Availability and changes">
            We work to keep ROOFZEUS reliable and available, but no online
            service can guarantee uninterrupted access. We may update features,
            flows, and UI as the platform improves. If a change materially
            impacts these terms, we’ll update the “Last updated” date and, when
            appropriate, notify users.
          </Section>

          <Section title="Disclaimer">
            ROOFZEUS helps organize information and workflows. It does not
            replace professional judgment, compliance requirements, or proper
            bookkeeping/legal processes. You are responsible for your business
            decisions, job execution, and regulatory compliance.
          </Section>

          <Section title="Limitation of liability">
            To the extent permitted by law, ROOFZEUS and its operators are not
            liable for indirect, incidental, or consequential damages arising
            from the use of the service. Total liability is limited to the
            amount paid for the service during the relevant period, where
            applicable.
          </Section>

          <Section title="Contact">
            Questions about these terms? Contact us through the support method
            listed in the app or the contact channel you use to reach ROOFZEUS.
          </Section>

          <div className="text-[12px] text-white/45">
            This document is a practical baseline and not legal advice. Consider
            having counsel review before you process payments at scale.
          </div>
        </div>
      </section>
    </main>
  );
}
