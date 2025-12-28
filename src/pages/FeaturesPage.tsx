// src/pages/FeaturesPage.tsx
import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import {
  CalendarDays,
  ClipboardList,
  LineChart,
  Users,
  Camera,
  Receipt,
  FileText,
  Wrench,
  CheckCircle2,
  ArrowRight,
  Sparkles,
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

type FeatureCard = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  bullets: string[];
};

const featureCards: FeatureCard[] = [
  {
    icon: ClipboardList,
    title: "Job pages that keep everything together",
    desc: "Every job has a single source of truth — money, schedule, photos, notes, and progress.",
    bullets: [
      "Sq ft, rate, fees, materials & labor",
      "Notes + photos in the same place",
      "Status tracking that matches real workflows",
    ],
  },
  {
    icon: CalendarDays,
    title: "Scheduling built for roofing stages",
    desc: "Dry-in, shingles, punch — set dates and keep the whole pipeline visible across jobs.",
    bullets: [
      "Stage dates stay readable (no guessing)",
      "See what’s coming this week",
      "Crew stays aligned with the plan",
    ],
  },
  {
    icon: Users,
    title: "Crew workflow without chaos",
    desc: "Invite the team, assign jobs, and keep field updates tied to the job — not lost in texts.",
    bullets: [
      "Role-aware access (owner vs crew)",
      "Assigned jobs for each crew member",
      "Clean accountability and history",
    ],
  },
  {
    icon: Receipt,
    title: "Materials + receipts tied to profit",
    desc: "Log spend with receipts so job margins stay accurate — not a rough estimate.",
    bullets: [
      "Track material spend per job",
      "Receipt attachments for proof",
      "Clear job-level margin visibility",
    ],
  },
  {
    icon: LineChart,
    title: "Financial overview by any date range",
    desc: "Filter by any range and see earnings, costs, payouts, and net profit — fast.",
    bullets: [
      "Company-wide or per job insights",
      "Revenue, materials, payouts, net",
      "Trend visibility without spreadsheets",
    ],
  },
  {
    icon: FileText,
    title: "Payouts and pay stubs that make sense",
    desc: "Track crew payouts and generate stubs with the details you’ll want later.",
    bullets: [
      "Pending vs paid filtering",
      "Stub history stays organized",
      "Better documentation for everyone",
    ],
  },
  {
    icon: Camera,
    title: "Photos + notes where they belong",
    desc: "Capture progress in the field and keep it attached to the job forever.",
    bullets: [
      "Before / during / after documentation",
      "Notes tied to the correct address/job",
      "No more hunting through phones",
    ],
  },
  {
    icon: Wrench,
    title: "Built around real contractor ops",
    desc: "This isn’t generic project software. It’s shaped around how roofing actually moves.",
    bullets: [
      "Stages, crew, payouts, profit clarity",
      "Fast workflow with minimal admin work",
      "Designed for multi-company SaaS scale",
    ],
  },
];

export default function FeaturesPage() {
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
              <Pill>Product</Pill>
              <Pill>Roofing-first workflows</Pill>
              <Pill>Built for teams</Pill>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]"
            >
              Features that make jobs easier to run —
              <span className="text-[#cfae5d]"> and money easier to track</span>
              .
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="max-w-2xl text-white/70 leading-relaxed"
            >
              ROOFZEUS keeps your operation clear: job pages that hold the
              truth, scheduling that matches roofing stages, crew updates in one
              place, and financial visibility that doesn’t rely on spreadsheets.
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
                to="/pricing"
                className={cx(
                  "inline-flex items-center justify-center gap-2",
                  "rounded-xl border border-[#3a3f4b] bg-white/5 px-5 py-3",
                  "text-sm font-semibold text-[#f5f6f8] hover:bg-white/10 transition"
                )}
              >
                See pricing
              </Link>

              <Link
                to="/security"
                className={cx(
                  "inline-flex items-center justify-center gap-2",
                  "rounded-xl border border-[#3a3f4b] bg-[#0b0e14]/35 px-5 py-3",
                  "text-sm font-semibold text-white/80 hover:border-[#cfae5d] hover:text-white transition"
                )}
              >
                Security & data
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FEATURE GRID */}
      <section className="max-w-7xl mx-auto px-6 py-10">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {featureCards.map((f) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                variants={cardIn}
                whileHover={{ y: -3, transition: { duration: 0.25, ease } }}
                className="rounded-2xl border border-[#3a3f4b] bg-[#1f2430]/55 p-6"
              >
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#cfae5d]/25 bg-[#cfae5d]/10">
                    <Icon className="h-5 w-5 text-[#cfae5d]" />
                  </div>
                  <div className="text-sm font-semibold text-[#f5f6f8]">
                    {f.title}
                  </div>
                </div>

                <div className="mt-3 text-sm text-white/65 leading-relaxed">
                  {f.desc}
                </div>

                <div className="mt-4 space-y-2">
                  {f.bullets.map((b) => (
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

      {/* “WHY THIS WINS” STRIP */}
      <section className="max-w-7xl mx-auto px-6 py-14">
        <motion.div
          variants={cardIn}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="relative overflow-hidden rounded-2xl border border-[#3a3f4b] bg-[#0b0e14]/45 p-7"
        >
          <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#cfae5d]/10 blur-3xl" />

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[#cfae5d]">
                <Sparkles className="h-4 w-4" />
                <div className="text-sm font-semibold">The difference</div>
              </div>
              <div className="mt-2 text-2xl font-bold">
                Roofing workflows first — not generic “project management”.
              </div>
              <div className="mt-2 text-white/65 max-w-2xl">
                Your crew doesn’t need more tools. They need one system that
                keeps jobs and money organized with as little friction as
                possible.
              </div>
            </div>

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
          </div>
        </motion.div>
      </section>
    </main>
  );
}
