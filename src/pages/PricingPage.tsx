// src/pages/PricingPage.tsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, type Variants, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  ShieldCheck,
  Users,
  CalendarDays,
  LineChart,
  FileText,
  Receipt,
  ArrowRight,
  Minus,
  Plus,
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

const glowRing =
  "shadow-[0_0_0_1px_rgba(58,63,75,0.7),0_30px_100px_rgba(0,0,0,0.55)]";

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#3a3f4b] bg-[#0b0e14]/55 px-2.5 py-1 text-[11px] text-[#cfae5d]/80">
      {children}
    </span>
  );
}

function FeatureRow({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-semibold text-[#f5f6f8]">{title}</div>
        <div className="text-sm text-white/60 leading-relaxed">{desc}</div>
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-[#3a3f4b] bg-[#0b0e14]/35">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-4 flex items-center justify-between gap-4 text-left"
      >
        <div className="font-semibold text-[#f5f6f8]">{q}</div>
        <div className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5">
          {open ? (
            <Minus className="h-4 w-4 text-white/70" />
          ) : (
            <Plus className="h-4 w-4 text-white/70" />
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 text-sm text-white/65 leading-relaxed">
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PricingPage() {
  // One-plan pricing with a clean monthly/annual toggle.
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  const pricing = useMemo(() => {
    const monthly = 59;
    const annual = 590; // 2 months free vs 59*12 = 708
    return {
      monthly,
      annual,
      annualPerMonth: Math.round(annual / 12),
      savings: monthly * 12 - annual,
    };
  }, []);

  const priceLabel =
    billing === "monthly" ? `$${pricing.monthly}` : `$${pricing.annual}`;

  const priceSub = billing === "monthly" ? "per month" : "per year";

  return (
    <main className="min-h-screen bg-[#0b0e14] text-[#f5f6f8]">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-[#3a3f4b]">
        <div className="absolute inset-0">
          <div className="absolute -top-24 -left-24 h-[360px] w-[360px] rounded-full bg-[#cfae5d]/10 blur-[90px]" />
          <div className="absolute -bottom-24 -right-24 h-[420px] w-[420px] rounded-full bg-white/5 blur-[110px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(207,174,93,0.12),transparent_55%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.06),transparent_55%)]" />
        </div>

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="relative max-w-7xl mx-auto px-6 pt-20 pb-14"
        >
          <motion.div
            variants={fadeUp}
            className="flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-2">
              <Pill>14-day free trial</Pill>
              <Pill>No card required to try</Pill>
            </div>
          </motion.div>

          <div className="mt-10 grid lg:grid-cols-12 gap-10 items-start">
            <motion.div variants={fadeUp} className="lg:col-span-6">
              <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
                Simple pricing.
                <span className="block text-[#cfae5d]">
                  Everything included.
                </span>
              </h1>

              <p className="mt-5 text-lg  max-w-xl">
                ROOFZEUS is built for real roofing operations — jobs,
                scheduling, crew payouts, notes/photos, documents, and finance
                in one place. No add-on maze. No feature gates.
              </p>

              <div className="mt-8 flex flex-wrap gap-3 text-sm text-white/70">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  <CheckCircle2 className="h-4 w-4 text-[#cfae5d]" />
                  Unlimited jobs
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  <CheckCircle2 className="h-4 w-4 text-[#cfae5d]" />
                  Unlimited crew members
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  <CheckCircle2 className="h-4 w-4 text-[#cfae5d]" />
                  Pay stubs + invoices + reports
                </span>
              </div>
            </motion.div>

            {/* Pricing Card */}
            <motion.div
              variants={cardIn}
              className={`lg:col-span-6 rounded-2xl border border-[#3a3f4b] bg-gradient-to-tr from-[var(--color-background)] via-[var(--color-surface)] to-[var(--color-background)] p-6 ${glowRing}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mt-1 text-xl font-bold">THE THUNDER PLAN</div>
                  <div className="mt-1 text-sm text-[#cfae5d]/80">
                    Flat rate. Full access. Built for contractors.
                  </div>
                </div>

                {/* Billing toggle */}
                <div className="rounded-xl border border-white/10 bg-[#0b0e14]/35 p-1">
                  <div className="grid grid-cols-2 text-[12px]">
                    <button
                      type="button"
                      onClick={() => setBilling("monthly")}
                      className={[
                        "px-3 py-2 rounded-lg transition",
                        billing === "monthly"
                          ? "bg-[#cfae5d] text-black font-semibold"
                          : "text-white/70 hover:text-white",
                      ].join(" ")}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      onClick={() => setBilling("annual")}
                      className={[
                        "px-3 py-2 rounded-lg transition",
                        billing === "annual"
                          ? "bg-[#cfae5d] text-black font-semibold"
                          : "text-white/70 hover:text-white",
                      ].join(" ")}
                    >
                      Annual
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-end justify-between gap-4">
                <div>
                  <div className="flex items-baseline gap-2">
                    <div className="text-5xl font-extrabold tracking-tight">
                      {priceLabel}
                    </div>
                    <div className="text-white/60">{priceSub}</div>
                  </div>

                  {billing === "annual" ? (
                    <div className="mt-2 text-sm text-white/65">
                      That’s about{" "}
                      <span className="text-white/80 font-semibold">
                        ${pricing.annualPerMonth}/mo
                      </span>{" "}
                      billed annually — save{" "}
                      <span className="text-[#cfae5d] font-semibold">
                        ${pricing.savings}
                      </span>
                      /yr.
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-white/65">
                      Try it for 14 days — no payment info up front.
                    </div>
                  )}
                </div>

                <div className="text-right text-sm text-white/60">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                    <ShieldCheck className="h-4 w-4 text-[#cfae5d]" />
                    Cancel anytime
                  </div>
                </div>
              </div>

              <div className="mt-6 grid sm:grid-cols-2 gap-3">
                <Link
                  to="/signup"
                  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-[#cfae5d] px-4 py-3 font-semibold text-black hover:opacity-90 transition"
                >
                  Start free trial
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>

                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-xl border border-[#3a3f4b] bg-[#0b0e14]/35 px-4 py-3 font-semibold text-white hover:border-[#cfae5d] transition"
                >
                  Log in
                </Link>
              </div>

              <div className="mt-6 border-t border-white/10 pt-5">
                <div className="grid gap-3">
                  {[
                    "Unlimited jobs, notes, photos, and documents",
                    "Scheduling for dry-in, shingles, punch",
                    "Crew invites, assignments, pay stubs + payouts",
                    "Financial overview + profit visibility",
                  ].map((t) => (
                    <div
                      key={t}
                      className="flex items-start gap-2 text-sm text-white/70"
                    >
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-[#cfae5d]" />
                      <span>{t}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 text-[12px] text-white/50">
                  After your trial, you’ll be prompted to add payment details to
                  continue.
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* VALUE GRID */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="grid lg:grid-cols-12 gap-10"
        >
          <motion.div variants={fadeUp} className="lg:col-span-5">
            <motion.span
              variants={fadeUp}
              className="inline-flex mt-6 mb-2   rounded-full border border-[#cfae5d]/35 bg-[#cfae5d]/10 px-3 py-1 text-xl tracking-wide text-white "
            >
              What you're buying
            </motion.span>
            <p className="mt-3 text-white">
              ROOFZEUS isn’t a generic CRM. It’s a workflow tool built around
              how roofing work actually runs — from job setup to schedule to
              crew pay.
            </p>

            <div className="mt-6 rounded-2xl border border-[#3a3f4b] bg-[#1f2430] p-5">
              <div className="text-sm font-semibold">Why one plan?</div>
              <p className="mt-2 text-sm text-white/65 leading-relaxed">
                Pricing should be predictable. Your crew size changes, job
                volume changes, and seasonality changes — the tool should stay
                simple.
              </p>
              <div className="mt-4 grid gap-2 text-sm text-white/70">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-[#cfae5d]" />
                  <span>No “per user” math.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-[#cfae5d]" />
                  <span>No locked features.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-[#cfae5d]" />
                  <span>Same workflow for every contractor.</span>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="lg:col-span-7">
            <div className="rounded-2xl border border-[#3a3f4b] bg-[#0b0e14]/35 p-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <FeatureRow
                  icon={<CalendarDays className="h-4 w-4 text-[#cfae5d]" />}
                  title="Scheduling that matches the work"
                  desc="Dry-in, shingles, punch — planned and visible across your jobs."
                />
                <FeatureRow
                  icon={<Users className="h-4 w-4 text-[#cfae5d]" />}
                  title="Crew accountability"
                  desc="Invite members, assign jobs, collect photos/notes, generate pay stubs."
                />
                <FeatureRow
                  icon={<LineChart className="h-4 w-4 text-[#cfae5d]" />}
                  title="Profit clarity"
                  desc="See earnings, materials, payouts, and net profit without spreadsheets."
                />
                <FeatureRow
                  icon={<Receipt className="h-4 w-4 text-[#cfae5d]" />}
                  title="Payout tracking"
                  desc="Track pending vs paid, keep history, and export when you need it."
                />
                <FeatureRow
                  icon={<FileText className="h-4 w-4 text-[#cfae5d]" />}
                  title="Documents built in"
                  desc="Invoices, pay stubs, warranty reports — printable and tied to jobs."
                />
                <FeatureRow
                  icon={<ShieldCheck className="h-4 w-4 text-[#cfae5d]" />}
                  title="Org-scoped by design"
                  desc="Built for multi-tenant SaaS — every org stays isolated and secure."
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* FAQ */}
      <section className="bg-gradient-to-tr from-[var(--color-background)] via-[var(--color-surface)] to-[var(--color-background)] ">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="max-w-7xl mx-auto px-6 py-16"
        >
          <motion.div
            variants={fadeUp}
            className="flex items-end justify-between gap-6 flex-wrap"
          >
            <div>
              <h2 className="text-3xl font-bold">FAQ</h2>
              <p className="mt-2 text-white">
                Straight answers. No pricing games.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Pill>14-day trial</Pill>
              <Pill>Cancel anytime</Pill>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="mt-8 grid gap-3">
            <FaqItem
              q="Do I need a credit card to start the trial?"
              a={
                <>
                  No. You can create an account and use ROOFZEUS for 14 days
                  with no payment info. After the trial, you’ll be prompted to
                  add payment details to continue.
                </>
              }
            />
            <FaqItem
              q="Is it really unlimited crew members?"
              a={
                <>
                  Yes — invite your crew, assign jobs, and generate pay stubs
                  without worrying about seat limits.
                </>
              }
            />
            <FaqItem
              q="Can I switch between monthly and annual?"
              a={
                <>
                  Yep. Start monthly, then switch to annual once it’s working
                  for your operation. Annual includes a built-in discount (2
                  months free).
                </>
              }
            />
            <FaqItem
              q="Can I cancel anytime?"
              a={
                <>
                  Yes. Cancel whenever you want. Your data stays intact during
                  your paid period; after that, access is paused until you
                  resume.
                </>
              }
            />
          </motion.div>

          {/* Bottom CTA */}
          <motion.div
            variants={fadeUp}
            className="mt-12 rounded-2xl border border-[#3a3f4b] bg-[#0b0e14]/35 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
          >
            <div>
              <div className="text-xl font-bold">
                Ready to run jobs cleaner?
              </div>
              <div className="mt-1 text-sm text-white/65">
                Start the 14-day free trial. No card. Full access.
              </div>
            </div>

            <div className="flex gap-3">
              <Link
                to="/see-it-in-action"
                className="inline-flex md:hidden items-center justify-center rounded-xl bg-[#cfae5d] px-5 py-3 font-semibold text-black hover:opacity-90 transition"
              >
                Start free trial
              </Link>
              <Link
                to="/"
                className="inline-flex md:hidden items-center justify-center rounded-xl border border-[#3a3f4b] bg-[#0b0e14]/35 px-5 py-3 font-semibold text-white hover:border-[#cfae5d] transition"
              >
                Back home
              </Link>
            </div>
          </motion.div>
        </motion.div>
      </section>
    </main>
  );
}
