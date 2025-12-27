// src/pages/HomePage.tsx
import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import CountUp from "react-countup";
import logo from "../assets/roofzeus-white.png";

const ease = [0.16, 1, 0.3, 1] as const;

const stagger: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.06 },
  },
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

const fadeIn: Variants = {
  hidden: { opacity: 0, filter: "blur(6px)" },
  show: {
    opacity: 1,
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

const HERO_TICKER_ITEMS = [
  // Operations
  "Jobs",
  "Scheduling",
  "Pipeline",
  "Calendar",
  "Crew management",
  "Notes & photos",

  // Payments
  "Payouts",
  "Pay stubs",
  "Invoices",

  // Financial control
  "Revenue tracking",
  "Expense tracking",
  "Net profit",
  "Job profitability",
  "Material & labor costs",
  "Margin visibility",
  "Cash flow",
  "Profit trends",

  // Reporting
  "Financial reports",
  "Warranty reports",
];

function FeatureTicker({ items }: { items: string[] }) {
  // Render two identical groups and translate the track by exactly one group width.
  // The result is a seamless loop that never “resets”.
  return (
    <div
      className="relative overflow-hidden w-full max-w-full"
      style={{
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
        maskImage:
          "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
      }}
      aria-label="ROOFZEUS features"
    >
      <style>{`
        @keyframes rz-marquee {
          /* Move RIGHT: items exit right edge and re-enter from the left */
          from { transform: translateX(-50%); }
          to   { transform: translateX(0); }
        }
        .rz-marquee-track {
          display: flex;
          width: max-content;
          animation: rz-marquee 280s linear infinite;
          will-change: transform;
        }
        .rz-marquee-track:hover { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .rz-marquee-track { animation: none !important; }
        }
      `}</style>

      <div className="rz-marquee-track">
        {[0, 1].map((dup) => (
          <div key={dup} className="flex items-center gap-3 pr-3">
            {items.map((txt) => (
              <div key={dup + txt} className="flex items-center gap-3">
                <span className="text-white/55 text-[12px]">•</span>
                <span className="text-white/65 text-[12px] whitespace-nowrap">
                  {txt}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatMoney({
  cents,
  className,
}: {
  cents: number;
  className?: string;
}) {
  return (
    <span className={className}>
      <CountUp
        start={0}
        end={Math.round(cents / 100)}
        prefix="$"
        separator=","
        duration={1.2}
      />
    </span>
  );
}

function StatInt({ value, className }: { value: number; className?: string }) {
  return (
    <span className={className}>
      <CountUp start={0} end={value} duration={0.9} />
    </span>
  );
}

function DashboardPreview() {
  const kpis = [
    { label: "Net Profit", cents: 1842000, sub: "+12% vs last period" },
    { label: "Revenue", cents: 4290000, sub: "12 jobs" },
    { label: "Crew Payouts", cents: 1930000, sub: "8 stubs generated" },
    { label: "Materials", cents: 518000, sub: "Receipts logged" },
  ] as const;

  const schedule = [
    {
      stage: "Felt",
      address: "7421 Ridge Trail",
      when: "Mon • Jan 06",
      badge: "Scheduled",
    },
    {
      stage: "Shingles",
      address: "510 W Magnolia",
      when: "Tue • Jan 07",
      badge: "Scheduled",
    },
    {
      stage: "Punch",
      address: "11903 Oak Run",
      when: "Thu • Jan 09",
      badge: "Scheduled",
    },
  ] as const;

  const pipeline = [
    {
      status: "Active",
      address: "7421 Ridge Trail",
      profitCents: 312400,
      note: "Dry-in ready",
    },
    {
      status: "Pending",
      address: "510 W Magnolia",
      profitCents: 227900,
      note: "Awaiting material drop",
    },
    {
      status: "Invoiced",
      address: "2087 Brookside",
      profitCents: 441100,
      note: "Sent yesterday",
    },
    {
      status: "Paid",
      address: "1902 Cedar Pass",
      profitCents: 388600,
      note: "Paid • stub created",
    },
  ] as const;

  const activity: Array<{ t: string; m: string; cents?: number }> = [
    { t: "2h ago", m: "Pay stub created • Jose Martinez", cents: 286000 },
    { t: "Today", m: "Materials logged • shingles + ridge cap", cents: 86000 },
    { t: "Yesterday", m: "Job scheduled • Dry-in • 7421 Ridge Trail" },
  ];

  const pill = (text: string) => (
    <span className="inline-flex items-center rounded-full border border-[#3a3f4b] bg-[#0b0e14]/50 px-2.5 py-1 text-[11px] text-[#cfae5d]/80">
      {text}
    </span>
  );

  const statusStyles: Record<string, string> = {
    Active: "bg-[#cfae5d]/10 text-[#cfae5d] border-[#cfae5d]/25",
    Pending: "bg-white/5 text-white/70 border-white/10",
    Invoiced: "bg-white/5 text-white/70 border-white/10",
    Paid: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  };

  return (
    <motion.div
      variants={cardIn}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
      className="relative overflow-hidden rounded-2xl border border-[#3a3f4b] bg-[#1f2430] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
    >
      {/* ambient glow */}
      <div className="pointer-events-none absolute -top-28 -right-28 h-72 w-72 rounded-full bg-[#cfae5d]/12 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-28 h-72 w-72 rounded-full bg-white/6 blur-3xl" />

      {/* “app frame” header */}
      <div className="flex items-center justify-between gap-3 border-b border-[#3a3f4b] px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-[#0b0e14] border border-[#3a3f4b] flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-[#cfae5d]" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[#f5f6f8] truncate">
              Your business, in clear view.
            </div>
            <div className="text-[12px] text-[#cfae5d]/70 truncate">
              Last 7 days • All jobs • Org scoped
            </div>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <div className="rounded-full border border-[#3a3f4b] bg-[#0b0e14]/40 px-3 py-1 text-[11px] text-white/70">
            Jobs
          </div>
          <div className="rounded-full border border-[#3a3f4b] bg-[#0b0e14]/40 px-3 py-1 text-[11px] text-white/70">
            Payouts
          </div>
          <div className="rounded-full border border-[#cfae5d]/30 bg-[#cfae5d]/10 px-3 py-1 text-[11px] text-[#cfae5d]">
            Finance
          </div>
        </div>
      </div>

      {/* content */}
      <div className="p-5">
        {/* filter chips row */}
        <div className="flex flex-wrap items-center gap-2">
          {pill("Date: Last 7 days")}
          {pill("Status: Active + Pending")}
          {pill("Crew: All")}
          <span className="ml-auto hidden md:inline-flex items-center text-[11px] text-white/45">
            Live preview • static demo data
          </span>
        </div>

        {/* KPI row */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3"
        >
          {kpis.map((k) => (
            <motion.div
              key={k.label}
              variants={fadeUp}
              whileHover={{ y: -2, transition: { duration: 0.25, ease } }}
              className="rounded-xl border border-[#3a3f4b] bg-[#0b0e14]/45 p-4"
            >
              <div className="text-[11px] uppercase tracking-wide text-white/50">
                {k.label}
              </div>
              <div className="mt-1 text-xl font-semibold text-[#f5f6f8]">
                <StatMoney cents={k.cents} />
              </div>
              <div className="mt-1 text-[12px] text-[#cfae5d]/70">{k.sub}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* middle row */}
        <div className="mt-3 grid lg:grid-cols-12 gap-3">
          {/* Schedule */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
            className="lg:col-span-7 rounded-xl border border-[#3a3f4b] bg-[#0b0e14]/35"
          >
            <div className="flex items-center justify-between border-b border-[#3a3f4b] px-4 py-3">
              <div className="text-sm font-semibold text-[#f5f6f8]">
                Scheduled Work
              </div>
              <div className="text-[12px] text-[#cfae5d]/70">Next 7 days</div>
            </div>

            <div className="px-2 py-2">
              {schedule.map((s, idx) => (
                <motion.div
                  key={s.address + s.stage}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.55, ease, delay: idx * 0.06 }}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-white/5 transition"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {s.address}
                    </div>
                    <div className="text-[12px] text-[#cfae5d]/70">
                      {s.stage}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-[12px] text-white/55">{s.when}</div>
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70">
                      {s.badge}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Profit sparkline + quick insights */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
            className="lg:col-span-5 rounded-xl border border-[#3a3f4b] bg-[#0b0e14]/35 p-4"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[#f5f6f8]">
                Profit Trend
              </div>
              <div className="text-[12px] text-[#cfae5d]/70">7-day</div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.99 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.65, ease }}
              className="mt-3 rounded-xl border border-[#3a3f4b] bg-[#0b0e14]/45 p-3"
            >
              <svg viewBox="0 0 240 72" className="w-full h-[72px]">
                <defs>
                  <linearGradient id="g1" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0" stopColor="rgba(207,174,93,0.15)" />
                    <stop offset="1" stopColor="rgba(207,174,93,0.55)" />
                  </linearGradient>
                </defs>
                <path
                  d="M6,54 C26,44 34,56 54,42 C74,28 84,36 104,30 C124,24 134,36 154,22 C174,8 194,18 234,10"
                  fill="none"
                  stroke="rgba(207,174,93,0.85)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <path
                  d="M6,54 C26,44 34,56 54,42 C74,28 84,36 104,30 C124,24 134,36 154,22 C174,8 194,18 234,10 L234,72 L6,72 Z"
                  fill="url(#g1)"
                  opacity="0.35"
                />
              </svg>

              <div className="mt-2 flex items-center justify-between">
                <div className="text-[12px] text-white/55">
                  Best day: <span className="text-white/80">Thu</span>
                </div>
                <div className="text-[12px] text-white/55">
                  Avg net:{" "}
                  <span className="text-white/80">
                    <StatMoney cents={263000} />
                  </span>
                </div>
              </div>
            </motion.div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <motion.div
                whileHover={{ y: -2, transition: { duration: 0.25, ease } }}
                className="rounded-xl border border-[#3a3f4b] bg-[#0b0e14]/45 p-3"
              >
                <div className="text-[11px] uppercase tracking-wide text-white/50">
                  Punch Ready
                </div>
                <div className="mt-1 text-lg font-semibold text-white">
                  <StatInt value={4} />
                </div>
                <div className="mt-1 text-[12px] text-white/50">
                  Jobs pending final pass
                </div>
              </motion.div>

              <motion.div
                whileHover={{ y: -2, transition: { duration: 0.25, ease } }}
                className="rounded-xl border border-[#3a3f4b] bg-[#0b0e14]/45 p-3"
              >
                <div className="text-[11px] uppercase tracking-wide text-white/50">
                  Stubs This Week
                </div>
                <div className="mt-1 text-lg font-semibold text-white">
                  <StatInt value={8} />
                </div>
                <div className="mt-1 text-[12px] text-white/50">
                  Crew accountability
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* bottom row */}
        <div className="mt-3 grid lg:grid-cols-12 gap-3">
          {/* Pipeline */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
            className="lg:col-span-7 rounded-xl border border-[#3a3f4b] bg-[#0b0e14]/35"
          >
            <div className="flex items-center justify-between border-b border-[#3a3f4b] px-4 py-3">
              <div className="text-sm font-semibold text-[#f5f6f8]">
                Job Pipeline
              </div>
              <div className="text-[12px] text-[#cfae5d]/70">
                Profit + status
              </div>
            </div>

            <div className="px-2 py-2">
              {pipeline.map((j, idx) => (
                <motion.div
                  key={j.address + j.status}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ duration: 0.55, ease, delay: idx * 0.06 }}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-white/5 transition"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          "inline-flex items-center rounded-full border px-2 py-1 text-[11px] " +
                          (statusStyles[j.status] ??
                            "bg-white/5 text-white/70 border-white/10")
                        }
                      >
                        {j.status}
                      </span>
                      <div className="text-sm font-semibold text-white truncate">
                        {j.address}
                      </div>
                    </div>
                    <div className="mt-1 text-[12px] text-white/50 truncate">
                      {j.note}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-[11px] text-white/45">Net</div>
                    <div className="text-sm font-semibold text-white">
                      <StatMoney cents={j.profitCents} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Activity */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
            className="lg:col-span-5 rounded-xl border border-[#3a3f4b] bg-[#0b0e14]/35"
          >
            <div className="flex items-center justify-between border-b border-[#3a3f4b] px-4 py-3">
              <div className="text-sm font-semibold text-[#f5f6f8]">
                Latest Activity
              </div>
              <div className="text-[12px] text-[#cfae5d]/70">Live updates</div>
            </div>

            <div className="px-4 py-3 space-y-3">
              {activity.map((a, idx) => (
                <motion.div
                  key={a.t + a.m}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ duration: 0.55, ease, delay: idx * 0.06 }}
                  className="flex gap-3"
                >
                  <div className="mt-2 h-2 w-2 rounded-full bg-[#cfae5d]/80 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[12px] text-white/45">{a.t}</div>
                    <div className="text-sm text-white/80 leading-snug">
                      {a.m}
                      {typeof a.cents === "number" ? (
                        <span className="text-[#cfae5d]/85">
                          {" "}
                          • <StatMoney cents={a.cents} />
                        </span>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              ))}

              <div className="pt-2 text-[12px] text-[#cfae5d]/70">
                Jobs • Notes • Photos • Pay stubs — all scoped per company.
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0b0e14] text-[#f5f6f8] overflow-x-hidden">
      {/* HERO */}
      <section className="relative overflow-hidden max-w-full">
        {/* subtle background texture */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(207,174,93,0.10),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.05),transparent_55%)]" />
        </div>

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="max-w-7xl mx-auto px-6 pt-28 pb-24 relative"
        >
          <div className="grid md:grid-cols-2 gap-16 items-center min-w-0">
            <motion.div variants={fadeUp} className="select-none min-w-0">
              <motion.img
                variants={fadeIn}
                className="max-w-[300px] mb-3"
                src={logo}
                alt="ROOFZEUS"
                draggable={false}
              />

              {/* Infinite feature ticker (replaces the static “Jobs • Schedules • …” line) */}
              <motion.div variants={fadeUp} className="mt-3 ">
                <span className="inline-flex items-center rounded-full border border-[#cfae5d]/35 bg-[#cfae5d]/10 px-3 py-1 text-[11px] tracking-wide text-[#cfae5d] mb-2">
                  Purpose-built for roofing contractors
                </span>
                <div className="flex-1">
                  <FeatureTicker items={HERO_TICKER_ITEMS} />
                </div>
              </motion.div>

              <motion.h1
                variants={fadeUp}
                className="text-3xl md:text-3xl lg:text-4xl font-poppins mt-3 leading-[1.05] tracking-tight text-white"
              >
                Total visibility into your roofing business.
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="mt-6 text-base md:text-lg text-white/70 max-w-xl leading-relaxed"
              >
                ROOFZEUS helps roofing contractors stay organized, track
                profitability, manage crew payouts, and keep schedules, photos,
                notes, and finances in one place — without spreadsheets or
                guesswork.
              </motion.p>

              <motion.div variants={fadeUp} className="mt-10 flex gap-4">
                <motion.a
                  whileHover={{ y: -1, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  href="http://app.localhost:5173/login"
                  className="bg-[#cfae5d] text-black px-6 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition"
                >
                  See it in action
                </motion.a>

                <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>
                  <Link
                    to="/pricing"
                    className="inline-block border border-[#3a3f4b] px-6 py-2 rounded-lg text-[#f5f6f8] text-sm hover:border-[#cfae5d] transition"
                  >
                    See pricing
                  </Link>
                </motion.div>
              </motion.div>
            </motion.div>

            {/* Preview */}
            <div className="min-w-0">
              <DashboardPreview />
            </div>
          </div>
        </motion.div>
      </section>

      {/* PAIN → SOLUTION */}
      <section className=" border-t border-[#3a3f4b]">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="max-w-7xl mx-auto px-6 py-20"
        >
          <motion.h2 variants={fadeUp} className="text-3xl font-bold mb-10">
            Stop juggling jobs across texts, notes, and spreadsheets
          </motion.h2>

          <motion.div variants={stagger} className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "Everything per job",
                desc: "Square footage, pricing, materials, notes, photos, status — all tied to the job so nothing gets lost.",
              },
              {
                title: "Scheduling that stays clear",
                desc: "Set dry-in, shingles, and punch dates and see what’s coming up across every job.",
              },
              {
                title: "Crew, without confusion",
                desc: "Invite your crew, assign jobs, and keep updates in one place — no more guessing who did what.",
              },
            ].map((f) => (
              <motion.div
                key={f.title}
                variants={cardIn}
                whileHover={{ y: -3, transition: { duration: 0.25, ease } }}
                className="bg-[#0b0e14] rounded-xl p-6 border border-[#3a3f4b]"
              >
                <h3 className="font-semibold text-lg mb-2 text-[#cfae5d]">
                  {f.title}
                </h3>
                <p className="text-sm ">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* FINANCIAL POWER */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
        >
          <motion.h2 variants={fadeUp} className="text-3xl font-bold mb-6">
            Know exactly where your money is
          </motion.h2>

          <motion.p
            variants={fadeUp}
            className="max-w-2xl text-[#cfae5d]/80 mb-12"
          >
            Filter by any date range and instantly see earnings, expenses,
            payouts, materials, and profit — across all jobs or down to a single
            one.
          </motion.p>

          <motion.div variants={stagger} className="grid md:grid-cols-2 gap-8">
            <motion.div
              variants={cardIn}
              whileHover={{ y: -3, transition: { duration: 0.25, ease } }}
              className="bg-[#1f2430] rounded-xl p-6 border border-[#3a3f4b]"
            >
              <h3 className="font-semibold mb-2">Financial Overview</h3>
              <p className="text-sm text-[#cfae5d]/70">
                A dedicated page for real-time financial insight across your
                operation.
              </p>
            </motion.div>

            <motion.div
              variants={cardIn}
              whileHover={{ y: -3, transition: { duration: 0.25, ease } }}
              className="bg-[#1f2430] rounded-xl p-6 border border-[#3a3f4b]"
            >
              <h3 className="font-semibold mb-2">Payouts & Pay Stubs</h3>
              <p className="text-sm text-[#cfae5d]/70">
                Generate, track, filter, and export pay stubs for your crew —
                pending or paid.
              </p>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* DOCUMENTS */}
      <section className="bg-[#1f2430] border-t border-[#3a3f4b]">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="max-w-7xl mx-auto px-6 py-20"
        >
          <motion.h2 variants={fadeUp} className="text-3xl font-bold mb-10">
            Professional documents, built-in
          </motion.h2>

          <motion.div variants={stagger} className="grid md:grid-cols-3 gap-8">
            {["Invoices", "Pay Stubs", "Warranty Reports"].map((doc) => (
              <motion.div
                key={doc}
                variants={cardIn}
                whileHover={{ y: -3, transition: { duration: 0.25, ease } }}
                className="bg-[#0b0e14] rounded-xl p-6 border border-[#3a3f4b]"
              >
                <h3 className="font-semibold">{doc}</h3>
                <p className="text-sm text-[#cfae5d]/70 mt-2">
                  Printable, emailable, and stored with each job.
                </p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* FINAL CTA */}
      <section className="max-w-7xl mx-auto px-6 py-24 text-center">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
        >
          <motion.h2 variants={fadeUp} className="text-4xl font-extrabold">
            Built for real roofing operations
          </motion.h2>

          <motion.p variants={fadeUp} className="mt-4 text-[#cfae5d]/80">
            Not generic software. Not spreadsheets. ROOFZEUS.
          </motion.p>

          <motion.a
            variants={fadeUp}
            whileHover={{ y: -1, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            href="http://app.localhost:5173/login"
            className="inline-block mt-10 bg-[#cfae5d] text-black px-8 py-4 rounded-lg font-semibold hover:opacity-90 transition"
          >
            Start Using ROOFZEUS
          </motion.a>
        </motion.div>
      </section>
    </main>
  );
}
