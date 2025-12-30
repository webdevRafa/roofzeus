// src/pages/FeaturesPage.tsx
import { Link } from "react-router-dom";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  LineChart,
  Users,
  Camera,
  Receipt,
  FileText,
  Wrench,
  ArrowRight,
  CheckCircle2,
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

type Feature = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  bullets: string[];
  micro?: string; // small “why it matters”
};

export default function FeaturesPage() {
  const features: Feature[] = useMemo(
    () => [
      {
        key: "jobs",
        icon: ClipboardList,
        title: "Job pages that hold the truth",
        desc: "Every job has one source of truth: pricing, notes, photos, schedule, materials, and payouts.",
        bullets: [
          "Sq ft, rate, fees, materials & labor in one place",
          "Notes + photos attached to the job — not texts",
          "Status tracking that matches real roofing workflows",
        ],
        micro: "Less chasing info. More clean execution.",
      },
      {
        key: "schedule",
        icon: CalendarDays,
        title: "Scheduling built for roofing stages",
        desc: "Dry-in, shingles, punch — your schedule stays readable across every job and crew.",
        bullets: [
          "Stage dates stay clear (no guessing)",
          "See what’s coming this week",
          "Crew stays aligned with the plan",
        ],
        micro: "Your pipeline stays visible at a glance.",
      },
      {
        key: "crew",
        icon: Users,
        title: "Crew workflow without chaos",
        desc: "Invite your team, assign jobs, and keep field updates tied to the job forever.",
        bullets: [
          "Role-aware access (owner vs crew)",
          "Assigned job lists per crew member",
          "Clean accountability and history",
        ],
        micro: "Updates live where they belong: on the job.",
      },
      {
        key: "money",
        icon: LineChart,
        title: "Profit clarity by any date range",
        desc: "Filter any range and see revenue, costs, payouts, and net profit — company-wide or per job.",
        bullets: [
          "Company-wide or per job insights",
          "Revenue, materials, payouts, net",
          "Trend visibility without spreadsheets",
        ],
        micro: "Know your numbers without building a workbook.",
      },
      {
        key: "receipts",
        icon: Receipt,
        title: "Materials + receipts tied to profit",
        desc: "Log spend with receipts so margins stay accurate — not a rough estimate.",
        bullets: [
          "Track material spend per job",
          "Receipt attachments for proof",
          "Clear job-level margin visibility",
        ],
        micro: "Margins you can defend — not guess.",
      },
      {
        key: "stubs",
        icon: FileText,
        title: "Payouts and pay stubs that make sense",
        desc: "Track payouts and generate stubs with the details you’ll want later.",
        bullets: [
          "Pending vs paid filtering",
          "Stub history stays organized",
          "Better documentation for everyone",
        ],
        micro: "Crews trust the numbers when the context is there.",
      },
      {
        key: "photos",
        icon: Camera,
        title: "Photos + notes where they belong",
        desc: "Capture progress in the field and keep it attached to the job forever.",
        bullets: [
          "Before / during / after documentation",
          "Notes tied to the correct address/job",
          "No more hunting through phones",
        ],
        micro: "Clean records = smoother handoffs and fewer disputes.",
      },
      {
        key: "ops",
        icon: Wrench,
        title: "Built around contractor reality",
        desc: "This isn’t generic project software. It’s shaped around how roofing actually moves.",
        bullets: [
          "Stages, crew, payouts, profit clarity",
          "Fast workflow with minimal admin work",
          "Designed for multi-company SaaS scale",
        ],
        micro: "Roofing-first, not “project management.”",
      },
    ],
    []
  );

  const [activeKey, setActiveKey] = useState(features[0].key);
  const active = features.find((f) => f.key === activeKey) ?? features[0];
  const ActiveIcon = active.icon;

  return (
    <main className="min-h-[calc(100vh-64px)] text-[#f5f6f8] overflow-x-hidden">
      {/* HERO */}
      <section className="relative overflow-hidden">
        {/* soft background texture */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(207,174,93,0.10),transparent_55%)]" />
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#cfae5d]/10 blur-3xl" />
          <div className="absolute -bottom-28 -left-28 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-6 pt-14 pb-10 relative">
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-6"
          >
            <motion.div variants={fadeUp} className="flex items-center gap-3">
              <Pill>Roofing-first workflows</Pill>
              <Pill>Org-scoped</Pill>
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
                See it in action
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
                Pricing
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

      {/* 3 PILLARS (less cards, more hierarchy) */}
      <section className="max-w-7xl mx-auto px-6 py-10">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="grid gap-4 lg:grid-cols-3"
        >
          {[
            {
              title: "Operations stay tight",
              desc: "Job pages, stages, and crew updates — everything stays tied to the work.",
              bullets: ["Jobs + stages", "Crew assignments", "Notes & photos"],
              icon: Wrench,
            },
            {
              title: "Money stays explainable",
              desc: "Track materials, payouts, and job profit with clean history you can export.",
              bullets: ["Receipts", "Pay stubs", "Profit clarity"],
              icon: LineChart,
            },
            {
              title: "Your system scales",
              desc: "Org-scoped by design. Built for multi-company growth without data mess.",
              bullets: ["Org separation", "Role access", "Clean records"],
              icon: Users,
            },
          ].map((p) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.title}
                variants={cardIn}
                className="rounded-2xl border border-[#3a3f4b] bg-[#1f2430]/55 p-6"
              >
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#cfae5d]/25 bg-[#cfae5d]/10">
                    <Icon className="h-5 w-5 text-[#cfae5d]" />
                  </div>
                  <div className="text-sm font-semibold">{p.title}</div>
                </div>

                <div className="mt-3 text-sm text-white/65 leading-relaxed">
                  {p.desc}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {p.bullets.map((b) => (
                    <span
                      key={b}
                      className="inline-flex items-center rounded-full border border-[#3a3f4b] bg-[#0b0e14]/35 px-2.5 py-1 text-[11px] text-white/70"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* INTERACTIVE FEATURE SWITCHER (the “creative” part) */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="grid gap-6 lg:grid-cols-12"
        >
          {/* Left: selector */}
          <motion.div variants={fadeUp} className="lg:col-span-5">
            <div className="flex items-center gap-2 text-[#cfae5d]">
              <Sparkles className="h-4 w-4" />
              <div className="text-sm font-semibold">Explore the workflow</div>
            </div>

            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">
              Everything is organized around the job.
            </h2>

            <p className="mt-2 text-white/65 leading-relaxed max-w-xl">
              Instead of 8 equal cards, here’s the flow in a way your brain can
              scan: pick a pillar, see what it does, and why it matters.
            </p>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {features.slice(0, 6).map((f) => {
                const Icon = f.icon;
                const isActive = f.key === activeKey;
                return (
                  <button
                    key={f.key}
                    onClick={() => setActiveKey(f.key)}
                    className={cx(
                      "text-left rounded-2xl border px-4 py-3 transition",
                      isActive
                        ? "border-[#cfae5d]/45 bg-[#cfae5d]/10"
                        : "border-[#3a3f4b] bg-[#0b0e14]/35 hover:bg-white/5 hover:border-white/20"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cx(
                          "inline-flex h-9 w-9 items-center justify-center rounded-xl border",
                          isActive
                            ? "border-[#cfae5d]/35 bg-[#cfae5d]/10"
                            : "border-white/10 bg-white/5"
                        )}
                      >
                        <Icon
                          className={cx(
                            "h-4 w-4",
                            isActive ? "text-[#cfae5d]" : "text-white/70"
                          )}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">
                          {f.title}
                        </div>
                        <div className="mt-0.5 text-[12px] text-white/55">
                          {f.micro}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* smaller “more” row */}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {features.slice(6).map((f) => {
                const Icon = f.icon;
                const isActive = f.key === activeKey;
                return (
                  <button
                    key={f.key}
                    onClick={() => setActiveKey(f.key)}
                    className={cx(
                      "text-left rounded-2xl border px-4 py-3 transition",
                      isActive
                        ? "border-[#cfae5d]/45 bg-[#cfae5d]/10"
                        : "border-[#3a3f4b] bg-[#0b0e14]/35 hover:bg-white/5 hover:border-white/20"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cx(
                          "inline-flex h-9 w-9 items-center justify-center rounded-xl border",
                          isActive
                            ? "border-[#cfae5d]/35 bg-[#cfae5d]/10"
                            : "border-white/10 bg-white/5"
                        )}
                      >
                        <Icon
                          className={cx(
                            "h-4 w-4",
                            isActive ? "text-[#cfae5d]" : "text-white/70"
                          )}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">
                          {f.title}
                        </div>
                        <div className="mt-0.5 text-[12px] text-white/55">
                          {f.micro}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Right: animated detail panel */}
          <motion.div variants={fadeUp} className="lg:col-span-7">
            <div className="relative overflow-hidden rounded-2xl border border-[#3a3f4b] bg-[#1f2430]/55 p-6">
              <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#cfae5d]/10 blur-3xl" />

              <AnimatePresence mode="wait">
                <motion.div
                  key={active.key}
                  initial={{ opacity: 0, y: 12, filter: "blur(10px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -10, filter: "blur(10px)" }}
                  transition={{ duration: 0.35, ease }}
                >
                  <div className="flex items-start gap-4">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#cfae5d]/25 bg-[#cfae5d]/10">
                      <ActiveIcon className="h-5 w-5 text-[#cfae5d]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg font-bold tracking-tight">
                        {active.title}
                      </div>
                      <div className="mt-2 text-sm text-white/65 leading-relaxed">
                        {active.desc}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-2">
                    {active.bullets.map((b) => (
                      <div key={b} className="flex gap-2 text-sm text-white/75">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#cfae5d]" />
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex flex-col sm:flex-row gap-3">
                    <Link
                      to="/see-it-in-action"
                      className={cx(
                        "inline-flex items-center justify-center gap-2",
                        "rounded-xl bg-[#cfae5d] px-5 py-3 text-sm font-semibold text-black",
                        "hover:bg-[#cfae5d]/90 transition"
                      )}
                    >
                      Watch the demo
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
                  </div>

                  <div className="mt-4 text-[12px] text-white/45">
                    Tip: This is built around roofing stages — not generic
                    “project management.”
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* SMALL PROOF STRIP (not a second big CTA section) */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <motion.div
          variants={cardIn}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="rounded-2xl border border-[#3a3f4b] bg-[#0b0e14]/35 p-6"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-white">
                Roofing workflows first — not generic software.
              </div>
              <div className="mt-1 text-sm text-white/65 max-w-2xl">
                Keep job truth, stages, crew updates, receipts, and payouts in
                one place so your operation stays clean as you scale.
              </div>
            </div>

            <Link
              to="/see-it-in-action"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#3a3f4b] bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 hover:border-[#cfae5d]/40 transition"
            >
              See it in action
              <ArrowRight className="h-4 w-4 text-white/70" />
            </Link>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
