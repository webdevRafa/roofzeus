// src/pages/HomePage.tsx
import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import CountUp from "react-countup";
import logo from "../assets/roofzeus-white.png";

const COLORS = {
  bg: "#0b0e14",
  surface: "#1f2430",
  border: "#3a3f4b",
  gold: "#cfae5d",
  white: "#ffffff",
  text: "#f5f6f8",
  black: "#000000",
} as const;

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

const fadeIn: Variants = {
  hidden: { opacity: 0, filter: "blur(8px)" },
  show: {
    opacity: 1,
    filter: "blur(0px)",
    transition: { duration: 0.8, ease },
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

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type MoneyValueMode = "cents" | "dollars";

/**
 * Money stat that supports either cents (recommended for app data)
 * or dollars (quick demo numbers). Prevents “cents prop” mismatch pain.
 */
function StatMoney({
  value,
  mode = "cents",
  className,
  prefix = "$",
}: {
  value: number;
  mode?: MoneyValueMode;
  className?: string;
  prefix?: string;
}) {
  const dollars = mode === "cents" ? value / 100 : value;
  const end = Math.round(dollars);

  return (
    <span className={className}>
      <CountUp
        start={0}
        end={end}
        prefix={prefix}
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

function LightningMark({ className }: { className?: string }) {
  // small inline “bolt” mark to reinforce your logo idea without overdoing it
  return (
    <svg
      className={className}
      width="14"
      height="16"
      viewBox="0 0 14 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8.5 0.8L1.4 9.2H6.9L5.5 15.2L12.6 6.8H7.1L8.5 0.8Z"
        fill={COLORS.white}
        opacity="0.95"
      />
    </svg>
  );
}

function ShellPill({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] tracking-wide",
        active
          ? `border-[${COLORS.gold}]/35 bg-[${COLORS.gold}]/10 text-[${COLORS.gold}]`
          : `border-[${COLORS.border}] bg-white/5 text-white/70`
      )}
      style={
        active
          ? {
              borderColor: "rgba(207,174,93,0.35)",
              backgroundColor: "rgba(207,174,93,0.10)",
              color: COLORS.gold,
            }
          : { borderColor: COLORS.border }
      }
    >
      {children}
    </span>
  );
}

function MetricCard({
  label,
  valueCents,
  sub,
  tone = "neutral",
}: {
  label: string;
  valueCents: number;
  sub: string;
  tone?: "neutral" | "gold";
}) {
  const isGold = tone === "gold";
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -2, transition: { duration: 0.25, ease } }}
      className="rounded-xl border p-4"
      style={{
        borderColor: COLORS.border,
        backgroundColor: "rgba(11,14,20,0.55)",
      }}
    >
      <div className="text-[11px] uppercase tracking-wider text-white/50">
        {label}
      </div>
      <div
        className="mt-1 text-xl font-semibold"
        style={{ color: COLORS.text }}
      >
        <StatMoney value={valueCents} mode="cents" />
      </div>
      <div
        className="mt-1 text-[12px]"
        style={{
          color: isGold ? "rgba(207,174,93,0.80)" : "rgba(245,246,248,0.55)",
        }}
      >
        {sub}
      </div>
    </motion.div>
  );
}

function DashboardPreview() {
  const kpis = [
    {
      label: "Net Profit",
      valueCents: 1842000,
      sub: "↑ 12% vs last period",
      tone: "gold" as const,
    },
    { label: "Revenue", valueCents: 4290000, sub: "12 jobs in range" },
    { label: "Crew Payouts", valueCents: 1930000, sub: "8 stubs generated" },
    { label: "Materials", valueCents: 518000, sub: "Receipts logged" },
  ];

  const schedule = [
    {
      stage: "Dry-in (felt)",
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
  ];

  const pipeline = [
    {
      status: "Active",
      address: "7421 Ridge Trail",
      profitCents: 312400,
      note: "Ready for dry-in",
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
      note: "Invoice sent yesterday",
    },
    {
      status: "Paid",
      address: "1902 Cedar Pass",
      profitCents: 388600,
      note: "Paid • stub created",
    },
  ];

  const activity: Array<{ t: string; m: string; cents?: number }> = [
    { t: "2h ago", m: "Pay stub created • Jose Martinez", cents: 286000 },
    { t: "Today", m: "Materials logged • shingles + ridge cap", cents: 86000 },
    { t: "Yesterday", m: "Dry-in scheduled • 7421 Ridge Trail" },
  ];

  const statusStyles: Record<
    string,
    { bg: string; border: string; text: string }
  > = {
    Active: {
      bg: "rgba(207,174,93,0.10)",
      border: "rgba(207,174,93,0.28)",
      text: COLORS.gold,
    },
    Pending: {
      bg: "rgba(255,255,255,0.05)",
      border: "rgba(255,255,255,0.10)",
      text: "rgba(245,246,248,0.75)",
    },
    Invoiced: {
      bg: "rgba(255,255,255,0.05)",
      border: "rgba(255,255,255,0.10)",
      text: "rgba(245,246,248,0.75)",
    },
    Paid: {
      bg: "rgba(207,174,93,0.10)",
      border: "rgba(207,174,93,0.20)",
      text: "rgba(207,174,93,0.90)",
    },
  };

  return (
    <motion.div
      variants={cardIn}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
      className="relative overflow-hidden rounded-2xl border shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
      style={{ borderColor: COLORS.border, backgroundColor: COLORS.surface }}
    >
      {/* ambient glows */}
      <div
        className="pointer-events-none absolute -top-32 -right-28 h-80 w-80 rounded-full blur-3xl"
        style={{ backgroundColor: "rgba(207,174,93,0.12)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-28 -left-28 h-80 w-80 rounded-full blur-3xl"
        style={{ backgroundColor: "rgba(245,246,248,0.06)" }}
      />

      {/* app header */}
      <div
        className="flex items-center justify-between gap-3 border-b px-5 py-4"
        style={{ borderColor: COLORS.border }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center"
            style={{
              backgroundColor: COLORS.bg,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <LightningMark className="opacity-90" />
          </div>

          <div className="min-w-0">
            <div
              className="text-sm font-semibold truncate"
              style={{ color: COLORS.text }}
            >
              Command Center
            </div>
            <div
              className="text-[12px] truncate"
              style={{ color: "rgba(207,174,93,0.72)" }}
            >
              Last 7 days • All jobs • Org scoped
            </div>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <ShellPill>Jobs</ShellPill>
          <ShellPill>Payouts</ShellPill>
          <ShellPill active>Finance</ShellPill>
        </div>
      </div>

      {/* content */}
      <div className="p-5">
        {/* chip row */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px]"
            style={{
              borderColor: COLORS.border,
              backgroundColor: "rgba(11,14,20,0.55)",
              color: "rgba(207,174,93,0.80)",
            }}
          >
            Date: Last 7 days
          </span>
          <span
            className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px]"
            style={{
              borderColor: COLORS.border,
              backgroundColor: "rgba(11,14,20,0.55)",
              color: "rgba(207,174,93,0.80)",
            }}
          >
            Status: Active + Pending
          </span>
          <span
            className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px]"
            style={{
              borderColor: COLORS.border,
              backgroundColor: "rgba(11,14,20,0.55)",
              color: "rgba(207,174,93,0.80)",
            }}
          >
            Crew: All
          </span>

          <span className="ml-auto hidden md:inline-flex items-center text-[11px] text-white/45">
            Live preview • static demo data
          </span>
        </div>

        {/* KPI row */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.35 }}
          className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3"
        >
          {kpis.map((k) => (
            <MetricCard
              key={k.label}
              label={k.label}
              valueCents={k.valueCents}
              sub={k.sub}
              tone={k.tone ?? "neutral"}
            />
          ))}
        </motion.div>

        {/* rows */}
        <div className="mt-3 grid lg:grid-cols-12 gap-3">
          {/* schedule */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
            className="lg:col-span-7 rounded-xl border"
            style={{
              borderColor: COLORS.border,
              backgroundColor: "rgba(11,14,20,0.35)",
            }}
          >
            <div
              className="flex items-center justify-between border-b px-4 py-3"
              style={{ borderColor: COLORS.border }}
            >
              <div
                className="text-sm font-semibold"
                style={{ color: COLORS.text }}
              >
                Scheduled Work
              </div>
              <div
                className="text-[12px]"
                style={{ color: "rgba(207,174,93,0.70)" }}
              >
                Next 7 days
              </div>
            </div>

            <div className="px-2 py-2">
              {schedule.map((s, idx) => (
                <motion.div
                  key={s.address + s.stage}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.55, ease, delay: idx * 0.06 }}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition"
                  style={{ backgroundColor: "transparent" }}
                  whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {s.address}
                    </div>
                    <div
                      className="text-[12px]"
                      style={{ color: "rgba(207,174,93,0.70)" }}
                    >
                      {s.stage}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-[12px] text-white/55">{s.when}</div>
                    <span
                      className="inline-flex items-center rounded-full border px-2 py-1 text-[11px]"
                      style={{
                        borderColor: "rgba(255,255,255,0.10)",
                        backgroundColor: "rgba(255,255,255,0.05)",
                        color: "rgba(245,246,248,0.75)",
                      }}
                    >
                      {s.badge}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* profit + quick insights */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
            className="lg:col-span-5 rounded-xl border p-4"
            style={{
              borderColor: COLORS.border,
              backgroundColor: "rgba(11,14,20,0.35)",
            }}
          >
            <div className="flex items-center justify-between">
              <div
                className="text-sm font-semibold"
                style={{ color: COLORS.text }}
              >
                Profit Trend
              </div>
              <div
                className="text-[12px]"
                style={{ color: "rgba(207,174,93,0.70)" }}
              >
                7-day
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.99 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.65, ease }}
              className="mt-3 rounded-xl border p-3"
              style={{
                borderColor: COLORS.border,
                backgroundColor: "rgba(11,14,20,0.55)",
              }}
            >
              <svg viewBox="0 0 240 72" className="w-full h-[72px]">
                <defs>
                  <linearGradient id="roofzeusGold" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0" stopColor="rgba(207,174,93,0.10)" />
                    <stop offset="1" stopColor="rgba(207,174,93,0.60)" />
                  </linearGradient>
                </defs>

                <path
                  d="M6,54 C26,44 34,56 54,42 C74,28 84,36 104,30 C124,24 134,36 154,22 C174,8 194,18 234,10"
                  fill="none"
                  stroke="rgba(207,174,93,0.90)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <path
                  d="M6,54 C26,44 34,56 54,42 C74,28 84,36 104,30 C124,24 134,36 154,22 C174,8 194,18 234,10 L234,72 L6,72 Z"
                  fill="url(#roofzeusGold)"
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
                    <StatMoney value={263000} mode="cents" />
                  </span>
                </div>
              </div>
            </motion.div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <motion.div
                whileHover={{ y: -2, transition: { duration: 0.25, ease } }}
                className="rounded-xl border p-3"
                style={{
                  borderColor: COLORS.border,
                  backgroundColor: "rgba(11,14,20,0.55)",
                }}
              >
                <div className="text-[11px] uppercase tracking-wider text-white/50">
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
                className="rounded-xl border p-3"
                style={{
                  borderColor: COLORS.border,
                  backgroundColor: "rgba(11,14,20,0.55)",
                }}
              >
                <div className="text-[11px] uppercase tracking-wider text-white/50">
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

        <div className="mt-3 grid lg:grid-cols-12 gap-3">
          {/* pipeline */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
            className="lg:col-span-7 rounded-xl border"
            style={{
              borderColor: COLORS.border,
              backgroundColor: "rgba(11,14,20,0.35)",
            }}
          >
            <div
              className="flex items-center justify-between border-b px-4 py-3"
              style={{ borderColor: COLORS.border }}
            >
              <div
                className="text-sm font-semibold"
                style={{ color: COLORS.text }}
              >
                Job Pipeline
              </div>
              <div
                className="text-[12px]"
                style={{ color: "rgba(207,174,93,0.70)" }}
              >
                Profit + status
              </div>
            </div>

            <div className="px-2 py-2">
              {pipeline.map((j, idx) => {
                const st = statusStyles[j.status] ?? statusStyles.Pending;
                return (
                  <motion.div
                    key={j.address + j.status}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.35 }}
                    transition={{ duration: 0.55, ease, delay: idx * 0.06 }}
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition"
                    whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center rounded-full border px-2 py-1 text-[11px]"
                          style={{
                            backgroundColor: st.bg,
                            borderColor: st.border,
                            color: st.text,
                          }}
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
                        <StatMoney value={j.profitCents} mode="cents" />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* activity */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
            className="lg:col-span-5 rounded-xl border"
            style={{
              borderColor: COLORS.border,
              backgroundColor: "rgba(11,14,20,0.35)",
            }}
          >
            <div
              className="flex items-center justify-between border-b px-4 py-3"
              style={{ borderColor: COLORS.border }}
            >
              <div
                className="text-sm font-semibold"
                style={{ color: COLORS.text }}
              >
                Latest Activity
              </div>
              <div
                className="text-[12px]"
                style={{ color: "rgba(207,174,93,0.70)" }}
              >
                Live updates
              </div>
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
                  <div
                    className="mt-2 h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: "rgba(207,174,93,0.85)" }}
                  />
                  <div className="min-w-0">
                    <div className="text-[12px] text-white/45">{a.t}</div>
                    <div className="text-sm text-white/80 leading-snug">
                      {a.m}
                      {typeof a.cents === "number" ? (
                        <span style={{ color: "rgba(207,174,93,0.90)" }}>
                          {" "}
                          • <StatMoney value={a.cents} mode="cents" />
                        </span>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              ))}

              <div
                className="pt-2 text-[12px]"
                style={{ color: "rgba(207,174,93,0.72)" }}
              >
                Jobs • Notes • Photos • Pay stubs — all scoped per company.
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

function FeatureCard({
  title,
  desc,
  eyebrow,
}: {
  title: string;
  desc: string;
  eyebrow: string;
}) {
  return (
    <motion.div
      variants={cardIn}
      whileHover={{ y: -4, transition: { duration: 0.25, ease } }}
      className="group rounded-2xl border p-6 relative overflow-hidden"
      style={{
        borderColor: COLORS.border,
        backgroundColor: "rgba(11,14,20,0.55)",
      }}
    >
      {/* hover glow */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ backgroundColor: "rgba(207,174,93,0.14)" }}
      />
      <div className="text-[11px] uppercase tracking-wider text-white/50">
        {eyebrow}
      </div>
      <div
        className="mt-2 text-lg font-semibold"
        style={{ color: COLORS.text }}
      >
        {title}
      </div>
      <p
        className="mt-2 text-sm leading-relaxed"
        style={{ color: "rgba(207,174,93,0.75)" }}
      >
        {desc}
      </p>
    </motion.div>
  );
}

function MiniStep({
  n,
  title,
  desc,
}: {
  n: string;
  title: string;
  desc: string;
}) {
  return (
    <motion.div
      variants={cardIn}
      className="rounded-2xl border p-6"
      style={{
        borderColor: COLORS.border,
        backgroundColor: "rgba(11,14,20,0.40)",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="h-9 w-9 rounded-xl border flex items-center justify-center text-sm font-semibold"
          style={{
            borderColor: "rgba(207,174,93,0.30)",
            backgroundColor: "rgba(207,174,93,0.10)",
            color: COLORS.gold,
          }}
        >
          {n}
        </div>
        <div className="text-sm font-semibold" style={{ color: COLORS.text }}>
          {title}
        </div>
      </div>
      <p className="mt-3 text-sm" style={{ color: "rgba(245,246,248,0.60)" }}>
        {desc}
      </p>
    </motion.div>
  );
}

export default function HomePage() {
  return (
    <main
      className="min-h-screen"
      style={{ backgroundColor: COLORS.bg, color: COLORS.text }}
    >
      {/* HERO */}
      <section className="relative overflow-hidden">
        {/* layered gradients */}
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at top, rgba(207,174,93,0.14), transparent 55%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at bottom, rgba(245,246,248,0.06), transparent 60%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-60"
            style={{
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0.25), rgba(0,0,0,0.55))",
            }}
          />
        </div>

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="max-w-7xl mx-auto px-6 pt-24 pb-20 relative"
        >
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            {/* left */}
            <motion.div variants={fadeUp} className="lg:col-span-5">
              <motion.img
                variants={fadeIn}
                className="max-w-[260px] sm:max-w-[300px] mb-4 select-none"
                src={logo}
                alt="ROOFZEUS"
                draggable={false}
              />

              <motion.div
                variants={fadeUp}
                className="flex items-center gap-2 text-[12px] tracking-wide"
              >
                <span
                  className="inline-flex items-center rounded-full border px-3 py-1"
                  style={{
                    borderColor: "rgba(207,174,93,0.25)",
                    backgroundColor: "rgba(207,174,93,0.08)",
                    color: "rgba(207,174,93,0.95)",
                  }}
                >
                  Built for real roofing operations
                </span>
                <span className="text-white/45 hidden sm:inline-flex">•</span>
                <span className="text-white/55 hidden sm:inline-flex">
                  Jobs • Schedules • Payouts • Finances
                </span>
              </motion.div>

              <motion.h1
                variants={fadeUp}
                className="mt-5 text-4xl sm:text-5xl font-extrabold leading-[1.05]"
              >
                Run every job like a{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, rgba(207,174,93,1), rgba(245,246,248,0.95))",
                  }}
                >
                  command center.
                </span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="mt-5 text-lg leading-relaxed max-w-xl"
                style={{ color: "rgba(245,246,248,0.68)" }}
              >
                ROOFZEUS gives contractors total control over{" "}
                <span style={{ color: "rgba(207,174,93,0.92)" }}>jobs</span>,{" "}
                <span style={{ color: "rgba(207,174,93,0.92)" }}>
                  scheduling
                </span>
                ,{" "}
                <span style={{ color: "rgba(207,174,93,0.92)" }}>
                  crew payouts
                </span>
                , and{" "}
                <span style={{ color: "rgba(207,174,93,0.92)" }}>profit</span> —
                organized, searchable, and scoped to each company.
              </motion.p>

              {/* hero stats */}
              <motion.div
                variants={fadeUp}
                className="mt-7 grid grid-cols-3 gap-3 max-w-xl"
              >
                {[
                  { label: "Jobs tracked", value: 142 },
                  { label: "Stubs generated", value: 86 },
                  { label: "Days scheduled", value: 31 },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl border px-4 py-3"
                    style={{
                      borderColor: COLORS.border,
                      backgroundColor: "rgba(11,14,20,0.55)",
                    }}
                  >
                    <div className="text-[11px] uppercase tracking-wider text-white/50">
                      {s.label}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      <StatInt value={s.value} />
                    </div>
                  </div>
                ))}
              </motion.div>

              {/* CTAs */}
              <motion.div
                variants={fadeUp}
                className="mt-8 flex flex-wrap gap-3"
              >
                {/* Use Link for same-domain routing; change to your actual app route if needed */}
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-2 transition bg-[var(--btn-bg)] hover:bg-[var(--btn-hover-bg)] text-[var(--btn-text)] font-bold "
                >
                  Get Started
                  <LightningMark className="opacity-90" />
                </Link>

                <Link
                  to="/pricing"
                  className="inline-flex items-center justify-center rounded-xl border px-6 py-2 font-semibold transition"
                  style={{
                    borderColor: COLORS.border,
                    color: COLORS.text,
                    backgroundColor: "rgba(11,14,20,0.35)",
                  }}
                >
                  View Pricing
                </Link>

                <span className="inline-flex items-center text-[12px] text-white/50 pl-1">
                  No spreadsheets. No guesswork.
                </span>
              </motion.div>
            </motion.div>

            {/* right */}
            <motion.div variants={fadeUp} className="lg:col-span-7">
              <DashboardPreview />
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* SECTION: WHY (pain → control) */}
      <section
        className="border-t"
        style={{ borderColor: COLORS.border, backgroundColor: COLORS.surface }}
      >
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="max-w-7xl mx-auto px-6 py-20"
        >
          <motion.div variants={fadeUp} className="max-w-3xl">
            <div
              className="text-[12px] tracking-wide"
              style={{ color: "rgba(207,174,93,0.90)" }}
            >
              CONTROL
            </div>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold">
              Stop running jobs from memory, texts, and spreadsheets.
            </h2>
            <p
              className="mt-4 text-base sm:text-lg"
              style={{ color: "rgba(245,246,248,0.62)" }}
            >
              ROOFZEUS is built for the real workflow: from setting up a job, to
              scheduling the crew, to tracking materials and payouts — with
              clean reporting at every step.
            </p>
          </motion.div>

          <motion.div
            variants={stagger}
            className="mt-10 grid md:grid-cols-3 gap-6"
          >
            <FeatureCard
              eyebrow="JOB"
              title="Job-level control"
              desc="Square footage, price per square, profit, notes, photos, and status — organized per job, not scattered across devices."
            />
            <FeatureCard
              eyebrow="SCHEDULE"
              title="Scheduling clarity"
              desc="Plan dry-ins, shingles, and punch work with date visibility across your entire pipeline — and keep everyone aligned."
            />
            <FeatureCard
              eyebrow="CREW"
              title="Crew accountability"
              desc="Invite team members, assign work, and keep a clean paper trail with pay stubs and job activity scoped to your company."
            />
          </motion.div>
        </motion.div>
      </section>

      {/* SECTION: MONEY */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(207,174,93,0.10), transparent 60%)",
            }}
          />
        </div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="max-w-7xl mx-auto px-6 py-22 sm:py-24 relative"
        >
          <div className="grid lg:grid-cols-12 gap-10 items-start">
            <motion.div variants={fadeUp} className="lg:col-span-5">
              <div
                className="text-[12px] tracking-wide"
                style={{ color: "rgba(207,174,93,0.90)" }}
              >
                FINANCE
              </div>
              <h2 className="mt-2 text-3xl sm:text-4xl font-bold">
                Know exactly where your money is.
              </h2>
              <p
                className="mt-4 text-base sm:text-lg"
                style={{ color: "rgba(245,246,248,0.62)" }}
              >
                Filter by any date range and instantly see earnings, expenses,
                payouts, materials, and profit — across all jobs or down to a
                single one.
              </p>

              <motion.div
                variants={fadeUp}
                className="mt-8 grid grid-cols-2 gap-4"
              >
                <div
                  className="rounded-2xl border p-5"
                  style={{
                    borderColor: COLORS.border,
                    backgroundColor: "rgba(11,14,20,0.55)",
                  }}
                >
                  <div className="text-[11px] uppercase tracking-wider text-white/50">
                    This month net
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    <StatMoney value={1842000} mode="cents" />
                  </div>
                  <div
                    className="mt-1 text-[12px]"
                    style={{ color: "rgba(207,174,93,0.75)" }}
                  >
                    Clean profit snapshot
                  </div>
                </div>

                <div
                  className="rounded-2xl border p-5"
                  style={{
                    borderColor: COLORS.border,
                    backgroundColor: "rgba(11,14,20,0.55)",
                  }}
                >
                  <div className="text-[11px] uppercase tracking-wider text-white/50">
                    Crew paid
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    <StatMoney value={1930000} mode="cents" />
                  </div>
                  <div
                    className="mt-1 text-[12px]"
                    style={{ color: "rgba(207,174,93,0.75)" }}
                  >
                    With printable stubs
                  </div>
                </div>
              </motion.div>
            </motion.div>

            <motion.div variants={fadeUp} className="lg:col-span-7">
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  {
                    title: "Financial Overview",
                    desc: "A dedicated page for real-time insight across your operation — totals, trends, and filters that match how contractors think.",
                  },
                  {
                    title: "Payouts & Pay Stubs",
                    desc: "Generate, track, filter, and export stubs for your crew — with a clean history you can trust.",
                  },
                  {
                    title: "Materials & Receipts",
                    desc: "Track material spending per job and keep receipts attached to the work — no more hunting through camera rolls.",
                  },
                  {
                    title: "Job Profit Snapshots",
                    desc: "See profit per job and across ranges so you always know what’s working, what’s bleeding, and what to fix.",
                  },
                ].map((x) => (
                  <motion.div
                    key={x.title}
                    variants={cardIn}
                    whileHover={{ y: -4, transition: { duration: 0.25, ease } }}
                    className="rounded-2xl border p-6"
                    style={{
                      borderColor: COLORS.border,
                      backgroundColor: "rgba(31,36,48,0.70)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <LightningMark className="opacity-80" />
                      <div className="text-lg font-semibold text-white">
                        {x.title}
                      </div>
                    </div>
                    <p
                      className="mt-2 text-sm leading-relaxed"
                      style={{ color: "rgba(245,246,248,0.62)" }}
                    >
                      {x.desc}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* SECTION: DOCUMENTS */}
      <section
        className="border-t"
        style={{ borderColor: COLORS.border, backgroundColor: COLORS.surface }}
      >
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="max-w-7xl mx-auto px-6 py-20"
        >
          <motion.div
            variants={fadeUp}
            className="flex items-end justify-between flex-wrap gap-6"
          >
            <div className="max-w-2xl">
              <div
                className="text-[12px] tracking-wide"
                style={{ color: "rgba(207,174,93,0.90)" }}
              >
                DOCUMENTS
              </div>
              <h2 className="mt-2 text-3xl sm:text-4xl font-bold">
                Professional docs, built-in.
              </h2>
              <p
                className="mt-4 text-base sm:text-lg"
                style={{ color: "rgba(245,246,248,0.62)" }}
              >
                Generate clean records tied to the work — so your paperwork
                looks as strong as your production.
              </p>
            </div>

            <motion.div variants={fadeUp} className="flex items-center gap-2">
              <ShellPill active>Printable</ShellPill>
              <ShellPill>Stored per job</ShellPill>
              <ShellPill>Org scoped</ShellPill>
            </motion.div>
          </motion.div>

          <motion.div
            variants={stagger}
            className="mt-10 grid md:grid-cols-3 gap-6"
          >
            {[
              {
                title: "Invoices",
                desc: "Presentable invoices tied to jobs and customers — keep the paper trail clean.",
              },
              {
                title: "Pay Stubs",
                desc: "Transparent crew payouts with clear line items and history.",
              },
              {
                title: "Warranty / 3rd Party",
                desc: "Printable packets for claims and third-party workflows — attached to the job.",
              },
            ].map((doc) => (
              <motion.div
                key={doc.title}
                variants={cardIn}
                whileHover={{ y: -4, transition: { duration: 0.25, ease } }}
                className="rounded-2xl border p-6"
                style={{
                  borderColor: COLORS.border,
                  backgroundColor: "rgba(11,14,20,0.55)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold text-white">
                    {doc.title}
                  </div>
                  <LightningMark className="opacity-75" />
                </div>
                <p
                  className="mt-2 text-sm leading-relaxed"
                  style={{ color: "rgba(207,174,93,0.75)" }}
                >
                  {doc.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* SECTION: PROCESS */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at top, rgba(245,246,248,0.05), transparent 60%)",
            }}
          />
        </div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="max-w-7xl mx-auto px-6 py-22 sm:py-24 relative"
        >
          <motion.div variants={fadeUp} className="max-w-2xl">
            <div
              className="text-[12px] tracking-wide"
              style={{ color: "rgba(207,174,93,0.90)" }}
            >
              WORKFLOW
            </div>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold">
              A roofing-first flow that feels obvious.
            </h2>
            <p
              className="mt-4 text-base sm:text-lg"
              style={{ color: "rgba(245,246,248,0.62)" }}
            >
              Contractors don’t need generic software. They need a system
              designed around the job lifecycle.
            </p>
          </motion.div>

          <motion.div
            variants={stagger}
            className="mt-10 grid md:grid-cols-3 gap-6"
          >
            <MiniStep
              n="1"
              title="Create the job"
              desc="Square footage, pricing, notes, photos — everything begins with the job."
            />
            <MiniStep
              n="2"
              title="Schedule production"
              desc="Dry-in, shingles, punch — visibility across your calendar and pipeline."
            />
            <MiniStep
              n="3"
              title="Close + pay out"
              desc="Track materials, generate pay stubs, and keep your profit clear."
            />
          </motion.div>
        </motion.div>
      </section>

      {/* FINAL CTA */}
      <section className="border-t" style={{ borderColor: COLORS.border }}>
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="max-w-7xl mx-auto px-6 py-20 text-center"
        >
          <motion.h2
            variants={fadeUp}
            className="text-3xl sm:text-4xl font-extrabold"
          >
            Built for real roofing operations.
          </motion.h2>

          <motion.p
            variants={fadeUp}
            className="mt-4 text-base sm:text-lg"
            style={{ color: "rgba(245,246,248,0.62)" }}
          >
            Not generic software. Not spreadsheets.{" "}
            <span style={{ color: "rgba(207,174,93,0.92)" }}>ROOFZEUS.</span>
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-8 flex items-center justify-center gap-3 flex-wrap"
          >
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4 font-semibold transition"
              style={{ backgroundColor: COLORS.gold, color: COLORS.black }}
            >
              Start Using ROOFZEUS
              <LightningMark className="opacity-90" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center rounded-xl border px-8 py-4 font-semibold transition"
              style={{
                borderColor: COLORS.border,
                color: COLORS.text,
                backgroundColor: "rgba(11,14,20,0.35)",
              }}
            >
              See Pricing
            </Link>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="mt-10 text-[12px] text-white/50"
          >
            Secure • Org-scoped • Built for contractors who want control
          </motion.div>
        </motion.div>
      </section>
    </main>
  );
}
