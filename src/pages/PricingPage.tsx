// src/pages/PricingPage.tsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import {
  CheckCircle2,
  ShieldCheck,
  Users,
  CalendarDays,
  LineChart,
  FileText,
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
    <span className="inline-flex items-center rounded-full border border-[#3a3f4b] bg-[#0b0e14]/55 px-2.5 py-1 text-[11px] text-white">
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

export default function PricingPage() {
  // One-plan pricing with a clean monthly/annual toggle.
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  const pricing = useMemo(() => {
    const monthly = 50;
    const annual = 500; // 2 months free vs 59*12 = 708
    return {
      monthly,
      annual,
      annualPerMonth: Math.round(annual / 12),
      savings: monthly * 12 - annual,
    };
  }, []);

  const priceLabel =
    billing === "monthly" ? `$${pricing.monthly}` : `$${pricing.annual}`;

  const priceSub = billing === "monthly" ? "/ month" : "/ year";

  return (
    <main className="min-h-screen bg-[#0b0e14] text-[#f5f6f8]">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-[#3a3f4b]">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="relative max-w-[1000px] mx-auto px-6 pt-20 pb-14"
        >
          <div className="mt-10 grid lg:grid-cols-12 gap-10 items-center">
            <motion.div variants={fadeUp} className="lg:col-span-6">
              <h1 className="text-2xl md:text-4xl font-extrabold leading-tight">
                One Plan,
                <span className="block">
                  <span className="text-[#cfae5d]">Everything</span> included.
                </span>
              </h1>
              <motion.div
                variants={fadeUp}
                className="flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-2">
                  <Pill>1 month trial</Pill>
                  <Pill>No card required to try</Pill>
                </div>
              </motion.div>
            </motion.div>

            {/* Pricing Card */}
            <motion.div
              variants={cardIn}
              className={`lg:col-span-6 rounded-md border-none bg-[var(--color-surface)]  p-6 `}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mt-1 text-md font-poppins">
                    Flate rate, full access.
                  </div>
                </div>

                {/* Billing toggle */}
                <div className="rounded-xl border border-white/10 bg-[#0b0e14]/35 p-1">
                  <div className="grid grid-cols-2 text-[10px] md:text-[12px]">
                    <button
                      type="button"
                      onClick={() => setBilling("monthly")}
                      className={[
                        "px-3 py-1 rounded-lg transition cursor-pointer",
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
                        "px-3 py-1 rounded-lg transition cursor-pointer",
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
                    <div className="text-4xl font-bold tracking-tight">
                      {priceLabel}
                    </div>
                    <div className="text-white/60 text-sm">{priceSub}</div>
                  </div>

                  {billing === "annual" ? (
                    <div className="mt-2 text-xs text-white/65 max-w-[200px]">
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
                    <div className="mt-2 text-xs text-white/65">
                      Try it risk free for 30 days.
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

              <Link
                to="/signup"
                className="group inline-flex items-center text-md justify-center gap-2 rounded-sm border-1 border-[var(--color-blue)] hover:bg-[var(--color-blue)] py-1 px-2  text-white hover:opacity-90 transition! duration-600 ease-in-out mt-5"
              >
                Get started
              </Link>

              <div className="mt-6 border-t border-white/10 pt-5">
                <div className="grid gap-3">
                  {[
                    "Unlimited jobs, notes, photos, and documents",
                    "Scheduling for dry-in, shingles, punch",
                    "Crew invites and job assignments",
                    "Financial overview",
                    "Professional documents",
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
                  After your trial ends, you’ll be prompted to add payment
                  details to continue.
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* VALUE GRID */}
      <section className="max-w-7xl mx-auto px-6 py-16  mt-10">
        <h1 className="text-2xl mb-4">Run your business like a pro.</h1>
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="grid lg:grid-cols-12 gap-10 bg-[var(--color-surface)]"
        >
          <motion.div variants={fadeUp} className="lg:col-span-12">
            <div className="rounded-2xl  px-6 py-20">
              <div className="grid sm:grid-cols-2 gap-6">
                <FeatureRow
                  icon={<CalendarDays className="h-4 w-4 text-[#cfae5d]" />}
                  title="Job scheduling"
                  desc="Schedule for dry-in, shingles and punch — easily see what's coming up."
                />
                <FeatureRow
                  icon={<Users className="h-4 w-4 text-[#cfae5d]" />}
                  title="Crew access"
                  desc="Invite members, assign jobs, collect photos/notes, generate pay stubs."
                />
                <FeatureRow
                  icon={<LineChart className="h-4 w-4 text-[#cfae5d]" />}
                  title="Financial clarity"
                  desc="See earnings, material expenses, payouts and know your profits."
                />

                <FeatureRow
                  icon={<FileText className="h-4 w-4 text-[#cfae5d]" />}
                  title="Professional documents"
                  desc="Create print-ready invoices, pay stubs, warranty reports."
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>
    </main>
  );
}
