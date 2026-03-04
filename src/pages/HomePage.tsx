// src/pages/HomePage.tsx
import { Link } from "react-router-dom";
import {
  motion,
  type Variants,
  useAnimation,
  AnimatePresence,
} from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useLayoutEffect } from "react";
import CountUp from "react-countup";
import logo from "../assets/logo-white.svg";
import jobdetails from "../assets/jobdetails.png";

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
export const textRevealDeluxe: Variants = {
  hidden: {
    opacity: 0,
    y: 18,
    filter: "blur(12px)",
  },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      ease,
      duration: 0.9,
      opacity: { duration: 0.55, ease },
      y: { duration: 0.9, ease },
      filter: { duration: 0.75, ease },
    },
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
  "Notes",
  "Photos",

  // Payments
  "Track payouts",
  "Paystubs",
  "Invoices",

  // Financial control
  "Revenue tracking",

  // Reporting
  "Financial reports",
  "Warranty reports",
];
const docs = [
  {
    title: "Invoices",
    desc: "Create clean invoices that match the job—then send or print in seconds.",
    bullets: ["PDF-ready", "Email from the job", "Stored per job"],
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
        <path
          d="M7 3h7l3 3v15a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <path
          d="M14 3v3a1 1 0 0 0 1 1h3"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <path
          d="M8.5 11h7M8.5 14h7M8.5 17h4.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    ),
    pill: "Preview",
  },
  {
    title: "Pay Stubs",
    desc: "Generate pay stubs with job context so crews trust the numbers.",
    bullets: ["Pending / paid states", "Export anytime", "Crew history"],
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
        <path
          d="M6 4h12a2 2 0 0 1 2 2v13l-2-1-2 1-2-1-2 1-2-1-2 1-2-1-2 1V6a2 2 0 0 1 2-2Z"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <path
          d="M8.5 9.5h7M8.5 13h7M8.5 16.5h4.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    ),
    pill: "Export",
  },
  {
    title: "Warranty Reports",
    desc: "Produce a clean packet for warranty or third-party workflows.",
    bullets: ["Job notes + photos", "Printable packet", "Attached to job"],
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
        <path
          d="M12 2 19 5v7c0 5-3.5 9-7 10-3.5-1-7-5-7-10V5l7-3Z"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <path
          d="M9.5 12.2 11 13.7l3.8-4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    pill: "Packet",
  },
] as const;

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
                <span className="text-white/30 blur-[1px] text-[12px]">|</span>
                <span className="text-white/80 text-[12px] whitespace-nowrap">
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
  duration = 1.2,
  delay = 0,
}: {
  cents: number;
  className?: string;
  duration?: number;
  delay?: number;
}) {
  return (
    <span className={className}>
      <CountUp
        start={0}
        end={Math.round(cents / 100)}
        prefix="$"
        separator=","
        duration={duration}
        delay={delay}
        enableScrollSpy
        scrollSpyOnce
        scrollSpyDelay={0}
      />
    </span>
  );
}

function StatInt({
  value,
  className,
  duration = 0.9,
  delay = 0,
}: {
  value: number;
  className?: string;
  duration?: number;
  delay?: number;
}) {
  return (
    <span className={className}>
      <CountUp
        start={0}
        end={value}
        duration={duration}
        delay={delay}
        enableScrollSpy
        scrollSpyOnce
        scrollSpyDelay={0}
      />
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
      viewport={{ once: false, amount: 0.25 }}
      className="relative  overflow-hidden hidden select-none md:block max-h-[500px] rounded-2xl border border-[#3a3f4b] bg-[#121826] shadow-[0_24px_80px_rgba(0,0,0,0.55)] opacity-40! blur-[2px]!"
    >
      {/* “app frame” header */}
      <div className="flex items-center justify-between gap-3 border-b border-[#3a3f4b] px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
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
          viewport={{ once: false, amount: 0.3 }}
          className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3"
        >
          {kpis.map((k, idx) => (
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
                <StatMoney cents={k.cents} delay={0.06 + idx * 0.06} />
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
            viewport={{ once: false, amount: 0.25 }}
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
                  viewport={{ once: false, amount: 0.4 }}
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
            viewport={{ once: false, amount: 0.25 }}
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
              viewport={{ once: false, amount: 0.35 }}
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
                <motion.path
                  d="M6,54 C26,44 34,56 54,42 C74,28 84,36 104,30 C124,24 134,36 154,22 C174,8 194,18 234,10"
                  fill="none"
                  stroke="rgba(207,174,93,0.85)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 1 }}
                  viewport={{ once: false, amount: 0.6 }}
                  transition={{ duration: 10, ease }}
                />

                <motion.path
                  d="M6,54 C26,44 34,56 54,42 C74,28 84,36 104,30 C124,24 134,36 154,22 C174,8 194,18 234,10 L234,72 L6,72 Z"
                  fill="url(#g1)"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 0.35 }}
                  viewport={{ once: false, amount: 0.6 }}
                  transition={{ duration: 0.7, ease, delay: 0.15 }}
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
                  <StatInt value={4} delay={0.08} />
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
                  <StatInt value={8} delay={0.12} />
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
function StickyCtaBar({ show }: { show: boolean }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {show ? (
        <motion.div
          initial={{ opacity: 0, y: -30, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="md:hidden fixed left-0 right-0 top-16 z-[40] px-4"
        >
          <div className="mx-auto max-w-7xl rounded-2xl border border-white/10 bg-[#0b0e14] backdrop-blur-md shadow-[0_18px_60px_rgba(0,0,0,0.55)] p-3">
            <div className="flex items-center gap-3 w-full">
              <Link
                to="/signup"
                className="flex-1 inline-flex items-center justify-center border-1 border-[var(--color-blue)] text-white px-4 py-2.5 rounded-xl text-xs font-semibold hover:opacity-90 transition"
              >
                Try it free
              </Link>

              <Link
                to="/pricing"
                className="flex-1 inline-flex items-center justify-center border border-[#3a3f4b]  px-4 py-2.5 rounded-xl text-xs font-semibold text-white hover:border-[#cfae5d] transition"
              >
                Pricing
              </Link>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

function ImageLightbox({
  open,
  src,
  alt,
  title,
  subtitle,
  onClose,
}: {
  open: boolean;
  src: string;
  alt: string;
  title?: string;
  subtitle?: string;
  onClose: () => void;
}) {
  // Prevent scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop */}
          <motion.button
            type="button"
            className="absolute inset-0 bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-label="Close preview"
          />

          {/* Modal frame */}
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.985, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 10, scale: 0.985, filter: "blur(6px)" }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[1200px] max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-[#0b0e14] shadow-[0_30px_120px_rgba(0,0,0,0.75)] flex flex-col"
          >
            {/* Top bar */}
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2 sm:px-4 sm:py-3">
              <div className="min-w-0">
                <div className="text-[12px] text-white/55">
                  {title ?? "Preview"}
                </div>
                <div className="text-sm font-semibold text-white/85 truncate">
                  {subtitle ?? "Click outside or press Esc to close"}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-white/80 hover:bg-white/10 transition"
              >
                <span className="hidden sm:inline">Close</span>
                <span aria-hidden className="text-white/60">
                  ✕
                </span>
              </button>
            </div>

            {/* Image (scrolls inside modal) */}
            <div className="relative bg-[#0b0e14] overflow-auto">
              <img
                src={src}
                alt={alt}
                className="block w-full h-auto select-none"
                draggable={false}
              />
            </div>

            {/* Helper hint */}
            <div className="flex items-center justify-between border-t border-white/10 px-3 py-2 sm:px-4 sm:py-3 text-[12px] text-white/55">
              <div>
                Tip: press <span className="text-white/70">Esc</span> to close
              </div>
              <div className="hidden sm:block">Click outside to dismiss</div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

export default function HomePage() {
  const builtForControls = useAnimation();

  const heroCtaRef = useRef<HTMLDivElement | null>(null);
  const [showStickyCtas, setShowStickyCtas] = useState(false);
  const heroLogoRef = useRef<HTMLImageElement | null>(null);

  const mountedRef = useRef(false);

  type LightboxState = {
    src: string;
    alt: string;
    title?: string;
    subtitle?: string;
  } | null;

  const [lightbox, setLightbox] = useState<LightboxState>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const el = heroCtaRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        // If the hero CTA row is NOT visible, show the sticky bar
        setShowStickyCtas(!entry.isIntersecting);
      },
      {
        // Trigger slightly before it fully leaves (nice UX)
        threshold: 0.15,
      }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = heroLogoRef.current;
    if (!el) return;

    const root = document.documentElement;

    const computeInView = () => {
      const rect = el.getBoundingClientRect();

      // Treat it as "in view" if any meaningful part is visible.
      // (accounts for sticky header height so we hide nav logo at top)
      const headerOffset = 64;
      const topOk = rect.bottom > headerOffset;
      const bottomOk = rect.top < window.innerHeight;
      return topOk && bottomOk;
    };

    // ✅ Set initial state BEFORE first paint (prevents flash)
    root.classList.toggle("rz-hero-logo-inview", computeInView());

    const obs = new IntersectionObserver(
      ([entry]) => {
        root.classList.toggle("rz-hero-logo-inview", entry.isIntersecting);
      },
      {
        rootMargin: "-64px 0px 0px 0px",
        threshold: 0.2,
      }
    );

    obs.observe(el);

    return () => {
      obs.disconnect();
      root.classList.remove("rz-hero-logo-inview");
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#0b0e14] text-[#f5f6f8] overflow-x-hidden">
      <StickyCtaBar show={showStickyCtas} />

      {/* HERO */}
      <section className="relative overflow-hidden max-w-full">
        {/* subtle background texture */}
        <div className="pointer-events-none absolute inset-0"></div>

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="max-w-7xl mx-auto px-6 pt-28 pb-24 relative"
        >
          <div className="grid md:grid-cols-2 gap-16 items-center min-w-0">
            <motion.div
              variants={fadeUp}
              className="select-none min-w-0 lg:translate-x-[200px] z-90"
            >
              <motion.img
                ref={heroLogoRef}
                variants={fadeIn}
                className="max-w-[250px] mb-3"
                src={logo}
                alt="ROOFZEUS"
                draggable={false}
              />

              {/* Infinite feature ticker (replaces the static “Jobs • Schedules • …” line) */}
              <motion.div variants={fadeUp} className="mt-3 ">
                <div className="flex-1">
                  <FeatureTicker items={HERO_TICKER_ITEMS} />
                </div>
              </motion.div>
              <motion.h1
                variants={fadeUp}
                className="text-2xl   font-poppins mt-5 leading-[1.05] tracking-tight text-white"
              >
                The best software for roofing contractors.
              </motion.h1>
              <motion.div
                ref={heroCtaRef}
                variants={fadeUp}
                className="mt-10 flex gap-4"
              >
                <motion.div whileTap={{ scale: 0.98 }}>
                  <Link
                    to="/signup"
                    className="inline-flex items-center justify-center border-b-1 border-b-[var(--color-blue)] hover:border-[#cfae5d] text-[#f5f6f8] px-6 py-2  text-sm font-semibold hover:opacity-90 transition"
                  >
                    Try it free
                  </Link>
                </motion.div>

                <motion.div whileTap={{ scale: 0.98 }}>
                  <Link
                    to="/pricing"
                    className="inline-block border-b border-b-[#3a3f4b] px-6 py-2  text-[#f5f6f8] text-sm hover:border-[#cfae5d] transition"
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
          animate={builtForControls}
          whileInView="show"
          viewport={{ once: false, amount: 0.25 }}
          onViewportEnter={() => {
            if (!mountedRef.current) return;
            builtForControls.start("show");
          }}
          onViewportLeave={() => {
            if (!mountedRef.current) return;
            builtForControls.set("hidden");
          }}
          className="max-w-7xl mx-auto px-6 py-30"
        >
          <div className="flex flex-col md:flex-row gap-6 items-center mb-2">
            <motion.button
              type="button"
              variants={cardIn}
              initial="hidden"
              whileInView="show"
              viewport={{ once: false, amount: 0.25 }}
              className="group relative mx-auto w-full max-w-[600px] mb-8 overflow-hidden rounded-2xl border border-white/10 bg-black/20 hidden"
              aria-label="Open full preview"
            >
              <img
                src={jobdetails}
                onClick={() =>
                  setLightbox({
                    src: jobdetails,
                    alt: "Dashboard preview",
                    title: "Job Details",
                    subtitle: "Keep everything tracked",
                  })
                }
                alt="ROOFZEUS app preview"
                className="block w-full h-auto cursor-zoom-in"
                draggable={false}
              />
            </motion.button>
            <div className="block mx-auto">
              <motion.h2
                variants={fadeUp}
                className="text-3xl font-bold mb-5 text-center "
              >
                Designed for how roofing actually works
              </motion.h2>
            </div>
          </div>

          <motion.div variants={stagger} className="grid md:grid-cols-2  gap-8">
            {[
              {
                title: "Everything about the job",
                desc: "Sq footage, pricing, materials, notes, photos, and status",
              },
              {
                title: "Clear scheduling",
                desc: "Schedule dry-ins, shingles, and punch work. Easily view what's coming up.",
              },
              {
                title: "Invite your crew",
                desc: "Invite members to your crew and assign jobs to get live feedback & updates.",
              },
              {
                title: "Keep track of your finances",
                desc: "Filter between dates and instantly see earnings, expenses, payouts, materials and profits.",
              },
            ].map((f) => (
              <motion.div
                key={f.title}
                variants={cardIn}
                className="bg-[#0b0e14] rounded-xl p-6 border border-[#3a3f4b]"
              >
                <h3 className="font-semibold text-xl mb-2 text-[var(--color-blue)] text-center">
                  {f.title}
                </h3>
                <p className="text-sm text-white/70 leading-relaxed text-center">
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
          <div className="mt-10">
            <p
              data-aos="fade-right"
              data-aos-duration="1000"
              className="text-base text-center md:text-xl max-w-6xl text-white mx-auto leading-relaxed"
            >
              Stay organized, track profitability, manage crew payouts
            </p>
            <p
              data-aos="fade-left"
              data-aos-duration="1000"
              className="text-base text-center md:text-xl max-w-6xl mt-0 text-white mx-auto leading-relaxed"
            >
              Keep schedules, photos, notes, and finances in one place
            </p>
          </div>
        </motion.div>
      </section>

      {/* DOCUMENTS */}
      <section className="bg-gradient-to-tr from-[var(--color-background)] via-[var(--color-surface)] to-[var(--color-background)] ">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: false, amount: 0.25 }}
          className="max-w-7xl mx-auto px-6 py-20"
        >
          <motion.div
            variants={fadeUp}
            className="flex items-end justify-between gap-6 flex-wrap"
          >
            <div className="min-w-0">
              <h2 className="text-3xl font-bold">
                Create professional documents
              </h2>
              <p className="mt-3 max-w-2xl text-white/70">
                Send invoices, generate pay stubs, and create warranty packets.
                Everything stays organized and easy to find later.
              </p>
            </div>
          </motion.div>

          <motion.div
            variants={stagger}
            className="mt-10 grid md:grid-cols-3 gap-8"
          >
            {docs.map((d) => (
              <motion.div
                key={d.title}
                variants={cardIn}
                className="group relative rounded-2xl  bg-[#0b0e14] p-6 overflow-hidden"
              >
                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl border border-[var(--color-blue)]/25 bg-[var(--color-blue)]/10 text-[#cfae5d] flex items-center justify-center">
                      {d.icon}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-xl text-white">
                        {d.title}
                      </h3>
                    </div>
                  </div>
                </div>

                <p className="relative mt-4 text-sm text-white/75 leading-relaxed">
                  {d.desc}
                </p>

                <div className="relative mt-5 space-y-2">
                  {d.bullets.map((b) => (
                    <div
                      key={b}
                      className="flex items-center gap-2 text-[12px] text-white/65"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-[#cfae5d]/80" />
                      <span className="truncate">{b}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      <ImageLightbox
        open={!!lightbox}
        src={lightbox?.src ?? ""}
        alt={lightbox?.alt ?? ""}
        title={lightbox?.title}
        subtitle={lightbox?.subtitle}
        onClose={() => setLightbox(null)}
      />
    </main>
  );
}
