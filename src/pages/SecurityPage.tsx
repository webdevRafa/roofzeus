// src/pages/SecurityPage.tsx
import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import {
  ShieldCheck,
  Users,
  KeyRound,
  Database,
  ClipboardCheck,
  FileDown,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

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

const cardIn: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.99, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.65, ease },
  },
};

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#3a3f4b] bg-[#0b0e14]/55 px-2.5 py-1 text-[11px] text-[#cfae5d]/80">
      {children}
    </span>
  );
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type TrustCard = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  bullets: string[];
};

const trustCards: TrustCard[] = [
  {
    icon: Database,
    title: "Org-scoped data separation",
    desc: "Each company’s workspace is isolated by organization membership so your jobs, photos, and finances don’t mix with anyone else.",
    bullets: [
      "Org membership gates access",
      "Clean separation as you scale SaaS",
      "Designed for multi-tenant growth",
    ],
  },
  {
    icon: Users,
    title: "Role-aware access for teams",
    desc: "Owners and admins control what crew can see and do — so the right people have the right access.",
    bullets: [
      "Owner/admin vs crew permissions",
      "Assigned job workflows for crew",
      "Clear accountability and boundaries",
    ],
  },
  {
    icon: KeyRound,
    title: "Secure sign-in and session handling",
    desc: "Authentication is handled through secure, modern auth flows and your team signs in with individual accounts.",
    bullets: [
      "Individual accounts per user",
      "Least-privilege access approach",
      "Strong defaults without extra setup",
    ],
  },
  {
    icon: ClipboardCheck,
    title: "Audit-friendly records",
    desc: "Operational history matters — especially with payouts, stubs, and job documentation.",
    bullets: [
      "Pay stub history stays organized",
      "Job documentation stays attached",
      "Easier to reconcile later",
    ],
  },
  {
    icon: FileDown,
    title: "Export mindset",
    desc: "You should never feel trapped. Reporting and exports are part of a healthy business system.",
    bullets: [
      "Records stay structured",
      "Built for clean reporting",
      "Future-proof for PDF/CSV exports",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Practical security posture",
    desc: "No marketing fluff. Clear defaults that support real contractor ops and real-world teams.",
    bullets: [
      "Sensible permissions model",
      "Org isolation first",
      "Trust built into the workflow",
    ],
  },
];

export default function SecurityPage() {
  return (
    <main className="min-h-[calc(100vh-64px)] text-[#f5f6f8] overflow-x-hidden">
      {/* HERO */}
      <section className="relative">
        <div className="max-w-7xl mx-auto px-6 pt-14 pb-10">
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-6"
          >
            <motion.div variants={fadeUp} className="flex items-center gap-3">
              <Pill>Security</Pill>
              <Pill>Org-scoped access</Pill>
              <Pill>Role-aware teams</Pill>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]"
            >
              Your data stays organized —
              <span className="text-[#cfae5d]"> and separated by company</span>.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="max-w-2xl text-white/70 leading-relaxed"
            >
              Roofing operations contain sensitive information: pricing,
              profitability, payouts, and job documentation. ROOFZEUS is
              designed around company workspaces (organizations) and role-aware
              access so your team can move fast without data getting messy.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="flex flex-col sm:flex-row gap-3"
            >
              <Link
                to="/see-it-in-action"
                className={cx(
                  "inline-flex items-center justify-center gap-2",
                  "rounded-xl bg-[#cfae5d] px-5 py-3 text-sm font-semibold text-black",
                  "hover:bg-[#cfae5d]/90 transition"
                )}
              >
                Start free trial
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                to="/features"
                className={cx(
                  "inline-flex items-center justify-center gap-2",
                  "rounded-xl border border-[#3a3f4b] bg-white/5 px-5 py-3",
                  "text-sm font-semibold text-[#f5f6f8] hover:bg-white/10 transition"
                )}
              >
                View features
              </Link>

              <Link
                to="/pricing"
                className={cx(
                  "inline-flex items-center justify-center gap-2",
                  "rounded-xl border border-[#3a3f4b] bg-[#0b0e14]/35 px-5 py-3",
                  "text-sm font-semibold text-white/80 hover:border-[#cfae5d] hover:text-white transition"
                )}
              >
                See pricing
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* TRUST GRID */}
      <section className="max-w-7xl mx-auto px-6 py-10">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {trustCards.map((c) => {
            const Icon = c.icon;
            return (
              <motion.div
                key={c.title}
                variants={cardIn}
                whileHover={{ y: -3, transition: { duration: 0.25, ease } }}
                className="rounded-2xl border border-[#3a3f4b] bg-[#1f2430]/55 p-6"
              >
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#cfae5d]/25 bg-[#cfae5d]/10">
                    <Icon className="h-5 w-5 text-[#cfae5d]" />
                  </div>
                  <div className="text-sm font-semibold text-[#f5f6f8]">
                    {c.title}
                  </div>
                </div>

                <div className="mt-3 text-sm text-white/65 leading-relaxed">
                  {c.desc}
                </div>

                <div className="mt-4 space-y-2">
                  {c.bullets.map((b) => (
                    <div key={b} className="flex gap-2 text-sm text-white/70">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#cfae5d]" />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* “WHAT THIS MEANS FOR A CREW” */}
      <section className="max-w-7xl mx-auto px-6 py-14">
        <motion.div
          variants={cardIn}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="relative overflow-hidden rounded-2xl border border-[#3a3f4b] bg-[#0b0e14]/45 p-7"
        >
          <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#cfae5d]/10 blur-3xl" />

          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="flex items-center gap-2 text-[#cfae5d]">
                <ShieldCheck className="h-4 w-4" />
                <div className="text-sm font-semibold">
                  What this means in the real world
                </div>
              </div>

              <div className="mt-2 text-2xl font-bold">
                Owners keep control. Crews stay productive.
              </div>

              <div className="mt-2 text-white/65 leading-relaxed">
                ROOFZEUS is built so teams can update jobs in the field, while
                business-critical info stays protected by roles and organization
                boundaries. It’s the clean way to run jobs without giving away
                the whole financial picture.
              </div>
            </div>

            <div className="lg:col-span-5 space-y-3">
              {[
                {
                  t: "Crew sees assigned work",
                  d: "Crew members focus on their jobs, notes, and photos — not your full financials.",
                },
                {
                  t: "Owners manage payout history",
                  d: "Pay stubs, payouts, and history stay clean and accessible when you need it.",
                },
                {
                  t: "Company data stays separated",
                  d: "Multi-tenant structure keeps each company’s workspace distinct and organized.",
                },
              ].map((x) => (
                <div
                  key={x.t}
                  className="rounded-2xl border border-[#3a3f4b] bg-[#1f2430]/55 p-5"
                >
                  <div className="text-sm font-semibold text-[#f5f6f8]">
                    {x.t}
                  </div>
                  <div className="mt-1 text-sm text-white/65">{x.d}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
