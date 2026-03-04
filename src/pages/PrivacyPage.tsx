// src/pages/PrivacyPage.tsx

import { motion, type Variants } from "framer-motion";

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

export default function PrivacyPage() {
  return (
    <main className="min-h-[calc(100vh-64px)] text-[#f5f6f8] overflow-x-hidden">
      <section className="max-w-7xl mx-auto px-6 pt-14 pb-10">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          <motion.h1
            variants={fadeUp}
            className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]"
          >
            Privacy Policy
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="max-w-2xl text-white/70 leading-relaxed"
          >
            RoofZeus
            <span className="text-white/70 align-super text-[0.6em] ml-1">
              ™
            </span>{" "}
            exists to help roofing contractors run jobs and track money easily.
            This policy explains what we collect, why we collect it, and what we
            do (and don’t) do with it.
          </motion.p>
        </motion.div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-14">
        <div className="grid gap-4">
          <Section title="What we collect">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <span className="text-white/80 font-semibold">
                  Account info
                </span>{" "}
                (name, email, password/auth identifiers).
              </li>
              <li>
                <span className="text-white/80 font-semibold">
                  Organization and team info
                </span>{" "}
                (company name, members you invite, roles/permissions).
              </li>
              <li>
                <span className="text-white/80 font-semibold">
                  Operational data
                </span>{" "}
                you add to ROOFZEUS (jobs, addresses, scheduling dates, notes,
                photos, payout records, pay stubs, invoices/reports).
              </li>
              <li>
                <span className="text-white/80 font-semibold">Usage data</span>{" "}
                (basic diagnostics like pages visited and performance errors) to
                keep the app stable and improve it.
              </li>
            </ul>
          </Section>

          <Section title="What we use it for">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                To provide the ROOFZEUS service (jobs, scheduling, crew
                workflow, payouts, documents).
              </li>
              <li>
                To secure access to your org and enforce role-based permissions.
              </li>
              <li>
                To support billing once you choose to continue after the trial.
              </li>
              <li>To troubleshoot issues and improve performance.</li>
            </ul>
          </Section>

          <Section title="What we do not do">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                We do <span className="text-white/80 font-semibold">not</span>{" "}
                sell your data.
              </li>
              <li>
                We do <span className="text-white/80 font-semibold">not</span>{" "}
                use your job data to train models for other customers.
              </li>
              <li>
                We do <span className="text-white/80 font-semibold">not</span>{" "}
                share your job, photo, or payout details with other companies.
              </li>
            </ul>
          </Section>

          <Section title="Data separation and access">
            ROOFZEUS is built as a multi-tenant SaaS. Your company’s workspace
            is scoped to your organization. Access depends on org membership and
            roles (owner/admin vs crew). Crew access can be limited to assigned
            jobs and job updates.
          </Section>

          <Section title="Third-party services">
            ROOFZEUS may rely on trusted infrastructure providers (hosting,
            authentication, storage, payment processors) to operate the
            platform. These providers process data only to deliver the service
            and maintain security and reliability.
          </Section>

          <Section title="Data retention">
            We retain your data while your account is active so the system can
            function as expected. If you cancel, we may retain data for a
            limited time for legal, security, and operational reasons, then
            follow our internal deletion process. (As the platform matures,
            we’ll provide self-serve export and deletion tools.)
          </Section>

          <Section title="Security">
            We use practical security measures to protect access to your account
            and organization. No system is perfect, but we design ROOFZEUS
            around org-scoped separation, role-based access, and secure sign-in
            flows.
          </Section>

          <Section title="Contact">
            Questions about privacy? Contact us through the support method
            listed in the app or the contact channel you use to reach ROOFZEUS.
          </Section>
        </div>
      </section>
    </main>
  );
}
