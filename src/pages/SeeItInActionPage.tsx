// src/pages/SeeItInActionPage.tsx
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  ShieldCheck,
  CalendarDays,
  LineChart,
  Users,
  Receipt,
  FileText,
  Wrench,
  CheckCircle2,
  ArrowRight,
  X,
  Loader2,
} from "lucide-react";

import logo from "../assets/roofzeus-white.png";

// Firebase
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
  type FieldValue,
} from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";

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

const LS_ACTIVE_ORG_KEY = "rr_activeOrgId"; // matches useMembership.tsx【turn2file1†useMembership.tsx†L31-L43】

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#3a3f4b] bg-[#0b0e14]/55 px-2.5 py-1 text-[11px] text-[#cfae5d]/80">
      {children}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[12px] text-white/70">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-[#3a3f4b] bg-[#0b0e14]/55 px-3 py-2 text-sm text-[#f5f6f8] placeholder:text-white/35 outline-none focus:border-[#cfae5d]/45 focus:ring-2 focus:ring-[#cfae5d]/10"
      />
    </label>
  );
}

function StepRow({
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
      className="rounded-2xl border border-[#3a3f4b] bg-[#1f2430]/55 p-5"
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0 rounded-xl border border-[#cfae5d]/25 bg-[#cfae5d]/10 px-3 py-2 text-sm font-semibold text-[#cfae5d]">
          {n}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#f5f6f8]">{title}</div>
          <div className="mt-1 text-sm text-white/65 leading-relaxed">
            {desc}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

type SignupDraft = {
  fullName: string;
  companyName: string;
  email: string;
  password: string;
  phone: string;
};

function SignupModal({
  open,
  onClose,
  priceMonthly,
}: {
  open: boolean;
  onClose: () => void;
  priceMonthly: number;
}) {
  const navigate = useNavigate();

  const [draft, setDraft] = useState<SignupDraft>({
    fullName: "",
    companyName: "",
    email: "",
    password: "",
    phone: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof SignupDraft>(key: K, value: SignupDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  const canSubmit = useMemo(() => {
    const emailOk = draft.email.trim().includes("@");
    const pwOk = draft.password.trim().length >= 6;
    const nameOk = draft.fullName.trim().length >= 2;
    const orgOk = draft.companyName.trim().length >= 2;
    return emailOk && pwOk && nameOk && orgOk && !submitting;
  }, [draft, submitting]);

  async function handleCreateAccount() {
    setError(null);
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      // 1) Create Firebase Auth user
      const cred = await createUserWithEmailAndPassword(
        auth,
        draft.email.trim(),
        draft.password
      );

      const uid = cred.user.uid;

      // Optional: set displayName
      await updateProfile(cred.user, { displayName: draft.fullName.trim() });

      // 2) Prepare org + bundle pack
      const orgRef = doc(collection(db, "organizations"));
      const orgId = orgRef.id;

      const now = serverTimestamp() as unknown as FieldValue;

      // organizations/{orgId}
      const orgDoc = {
        id: orgId,
        name: draft.companyName.trim(),
        legalName: draft.companyName.trim(),
        phone: draft.phone.trim() || undefined,
        email: draft.email.trim(),
        // "ownedByUserId" was mentioned in your plan; your current Org type
        // doesn’t define it, but adding it is safe/future-proof.
        ownedByUserId: uid,
        createdAt: now,
        updatedAt: now,
      };

      // users/{uid}
      const userDoc = {
        id: uid,
        name: draft.fullName.trim(),
        email: draft.email.trim(),
        phone: draft.phone.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };

      // employees/{uid}  (employeeId == auth uid)
      const employeeDoc = {
        id: uid,
        orgId,
        userId: uid,
        name: draft.fullName.trim(),
        email: draft.email.trim(),
        phone: draft.phone.trim() || undefined,
        role: "owner",
        accessRole: "admin",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      // memberships/{orgId}_{uid}  (deterministic id)
      const membershipId = `${orgId}_${uid}`;
      const membershipDoc = {
        id: membershipId,
        orgId,
        userId: uid,
        role: "owner", // OrgMemberRole supports "owner"
        employeeId: uid,
        createdAt: now,
        updatedAt: now,
      };

      // 3) Commit batch
      const batch = writeBatch(db);
      batch.set(orgRef, orgDoc);
      batch.set(doc(db, "users", uid), userDoc);
      batch.set(doc(db, "employees", uid), employeeDoc);
      batch.set(doc(db, "memberships", membershipId), membershipDoc);
      await batch.commit();

      // 4) Set active org for the app shell
      localStorage.setItem(LS_ACTIVE_ORG_KEY, orgId);

      // 5) Route into app
      // If your app expects a specific landing route after signup, swap this.
      navigate("/dashboard");
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* backdrop */}
          <motion.button
            aria-label="Close"
            className="absolute inset-0 bg-black/65"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.985, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 18, scale: 0.985, filter: "blur(8px)" }}
            transition={{ duration: 0.35, ease }}
            className={`relative w-full max-w-[920px] overflow-hidden rounded-2xl border border-[#3a3f4b] bg-[#0b0e14] ${glowRing}`}
          >
            {/* ambient glow */}
            <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#cfae5d]/12 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-white/6 blur-3xl" />

            <div className="flex items-center justify-between border-b border-[#3a3f4b] px-5 py-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#f5f6f8]">
                  Start your 14-day free trial
                </div>
                <div className="mt-0.5 text-[12px] text-white/55">
                  No payment info required. After 14 days, continue for $
                  {priceMonthly}/mo (flat).
                </div>
              </div>
              <button
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#3a3f4b] bg-white/5 text-white/70 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-0 md:grid-cols-5">
              {/* left */}
              <div className="md:col-span-2 border-b md:border-b-0 md:border-r border-[#3a3f4b] p-5">
                <div className="flex items-center gap-2">
                  <img src={logo} className="h-7" alt="ROOFZEUS" />
                  <Pill>14-day trial</Pill>
                </div>

                <div className="mt-4 space-y-3 text-sm text-white/70">
                  {[
                    "Create jobs, schedule stages, and track profit without spreadsheets.",
                    "Invite your crew, assign jobs, and generate pay stubs when you pay out.",
                    "Everything is scoped per company. Your data stays organized from day one.",
                  ].map((t) => (
                    <div key={t} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#cfae5d]" />
                      <div className="leading-relaxed">{t}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-[#cfae5d]/25 bg-[#cfae5d]/10 p-4">
                  <div className="text-[12px] font-semibold text-[#cfae5d]">
                    What we create for you instantly
                  </div>
                  <div className="mt-2 text-[12px] text-white/70 leading-relaxed">
                    A company workspace (organization), your user profile, your
                    employee profile, and an active membership linking you to
                    your company — all in one transaction.
                  </div>
                </div>
              </div>

              {/* right */}
              <div className="md:col-span-3 p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Your full name"
                    value={draft.fullName}
                    onChange={(v) => set("fullName", v)}
                    placeholder="e.g. Rafael Castro"
                    autoComplete="name"
                  />
                  <Field
                    label="Company name"
                    value={draft.companyName}
                    onChange={(v) => set("companyName", v)}
                    placeholder="e.g. Roger’s Roofing"
                    autoComplete="organization"
                  />
                  <Field
                    label="Work email"
                    value={draft.email}
                    onChange={(v) => set("email", v)}
                    type="email"
                    placeholder="you@company.com"
                    autoComplete="email"
                  />
                  <Field
                    label="Phone (optional)"
                    value={draft.phone}
                    onChange={(v) => set("phone", v)}
                    placeholder="(210) 555-0123"
                    autoComplete="tel"
                  />
                  <div className="sm:col-span-2">
                    <Field
                      label="Password"
                      value={draft.password}
                      onChange={(v) => set("password", v)}
                      type="password"
                      placeholder="Minimum 6 characters"
                      autoComplete="new-password"
                    />
                    <div className="mt-1 text-[11px] text-white/45">
                      Tip: use your work password manager. You can add teammates
                      after signup.
                    </div>
                  </div>
                </div>

                {error ? (
                  <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
                    {error}
                  </div>
                ) : null}

                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-[12px] text-white/50">
                    By continuing, you agree to reasonable terms. No spam.
                  </div>

                  <button
                    onClick={handleCreateAccount}
                    disabled={!canSubmit}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#cfae5d] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#cfae5d]/90 disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      <>
                        Create account
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-3 text-[11px] text-white/40">
                  After 14 days, you’ll be prompted to add payment details to
                  continue. Until then, full access.
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default function SeeItInActionPage() {
  // Pricing pick: simple + competitive for small/mid roofing contractors.
  // Flat per-company rate (not per seat) is a strong differentiator.
  const priceMonthly = 59;

  const [signupOpen, setSignupOpen] = useState(false);

  const features = useMemo(
    () => [
      {
        icon: LineChart,
        title: "Profit clarity by date range",
        desc: "Filter any range and see revenue, materials, crew payouts, and net profit — company-wide or per job.",
      },
      {
        icon: CalendarDays,
        title: "Scheduling that doesn’t get messy",
        desc: "Dry-in, shingles, punch — scheduled dates stay visible across every job and every crew member.",
      },
      {
        icon: Users,
        title: "Crew workflow built in",
        desc: "Invite your crew, assign jobs, and keep updates in one place — photos, notes, and progress.",
      },
      {
        icon: FileText,
        title: "Pay stubs that match reality",
        desc: "Generate and track pay stubs for payouts — filter pending vs paid, and keep history clean.",
      },
      {
        icon: Receipt,
        title: "Materials + receipts, tied to the job",
        desc: "Log material spend with receipts so your job margin stays accurate — not guessed.",
      },
      {
        icon: Wrench,
        title: "Job pages that actually help",
        desc: "Everything for the job in one place: scope, pricing, notes, photos, schedule, and money.",
      },
      {
        icon: ShieldCheck,
        title: "Built for multi-company growth",
        desc: "Organizations + memberships. Clean separation per company so scaling into SaaS is natural.",
      },
    ],
    []
  );

  return (
    <main className="min-h-screen bg-[#0b0e14] text-[#f5f6f8] overflow-x-hidden">
      <SignupModal
        open={signupOpen}
        onClose={() => setSignupOpen(false)}
        priceMonthly={priceMonthly}
      />

      {/* HERO */}
      <section className="relative overflow-hidden">
        {/* background texture */}
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
            className="flex flex-col gap-7"
          >
            <motion.div variants={fadeUp} className="flex items-center gap-3">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-full border border-[#3a3f4b] bg-white/5 px-3 py-1.5 text-[12px] text-white/70 hover:bg-white/10"
              >
                ← Back
              </Link>
              <Pill>Full access trial</Pill>
              <Pill>No card required</Pill>
              <Pill>Cancel anytime</Pill>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]"
            >
              One system for jobs, schedules, crew, and money —
              <span className="text-[#cfae5d]"> without the chaos</span>.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="max-w-2xl text-white/70 leading-relaxed"
            >
              ROOFZEUS is built for real roofing operations. Set schedules,
              capture photos and notes in the field, track materials and crew
              payouts, and always know your profit.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="flex flex-col sm:flex-row gap-3"
            >
              <Link
                to="/signup"
                onClick={() => setSignupOpen(true)}
                className="inline-flex md:hidden items-center justify-center gap-2 rounded-xl bg-[#cfae5d] px-5 py-3 text-sm font-semibold text-black hover:bg-[#cfae5d]/90"
              >
                Start 14-day free trial
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                to="/login"
                className="inline-flex md:hidden items-center justify-center gap-2 rounded-xl border border-[#3a3f4b] bg-white/5 px-5 py-3 text-sm font-semibold text-[#f5f6f8] hover:bg-white/10"
              >
                Log in
              </Link>
            </motion.div>

            <motion.div variants={fadeUp} className="flex flex-wrap gap-2">
              <Pill>Flat ${priceMonthly}/mo</Pill>
              <Pill>Unlimited crew members</Pill>
              <Pill>Pay stubs + payouts</Pill>
              <Pill>Scheduling pipeline</Pill>
              <Pill>Job photos + notes</Pill>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FEATURES GRID */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
        >
          <motion.h2 variants={fadeUp} className="text-3xl font-bold">
            What you get
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-3 max-w-2xl text-white/65">
            Everything here is designed around roofing workflows — job
            visibility, scheduling stages, crew accountability, and clean money
            tracking.
          </motion.p>

          <motion.div
            variants={stagger}
            className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {features.map((f) => {
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
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-7xl mx-auto px-6 pb-18">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="grid gap-6 lg:grid-cols-12"
        >
          <motion.div variants={fadeUp} className="lg:col-span-5">
            <h2 className="text-3xl font-bold">How teams use it daily</h2>
            <p className="mt-3 text-white/65 leading-relaxed">
              This is the simple loop: track the job, schedule the stages, let
              the crew update the job, then pay out and keep the history.
            </p>

            <div className="mt-5 rounded-2xl border border-[#3a3f4b] bg-[#0b0e14]/35 p-5">
              <div className="text-[12px] uppercase tracking-wide text-white/45">
                Trial expectations
              </div>
              <div className="mt-2 space-y-2 text-sm text-white/70">
                <div className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#cfae5d]" />
                  <span>Full access for 14 days. No card upfront.</span>
                </div>
                <div className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#cfae5d]" />
                  <span>Invite your crew and test real workflows.</span>
                </div>
                <div className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#cfae5d]" />
                  <span>After 14 days, add payment to continue.</span>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div variants={stagger} className="lg:col-span-7 grid gap-3">
            <StepRow
              n="01"
              title="Create jobs + capture the money"
              desc="Square footage, rate, fees, materials, notes, photos — everything tied to the job."
            />
            <StepRow
              n="02"
              title="Schedule stages across the pipeline"
              desc="Set dry-in, shingles, and punch dates. The schedule stays visible across the whole company."
            />
            <StepRow
              n="03"
              title="Crew updates in the field"
              desc="Crew members can add notes/photos on assigned jobs, keeping everything current."
            />
            <StepRow
              n="04"
              title="Pay out + generate pay stubs"
              desc="Track payouts and produce pay stubs with history (pending vs paid) when you close the loop."
            />
          </motion.div>
        </motion.div>
      </section>

      {/* PRICING */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="grid gap-6 lg:grid-cols-12"
        >
          <motion.div variants={fadeUp} className="lg:col-span-6">
            <h2 className="text-3xl font-bold">Simple pricing</h2>
            <p className="mt-3 text-white/65 leading-relaxed">
              Flat monthly pricing makes it easy to adopt. No per-seat pricing
              that punishes you for growing.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Pill>Unlimited crew</Pill>
              <Pill>Unlimited jobs</Pill>
              <Pill>Pay stubs included</Pill>
              <Pill>Scheduling included</Pill>
            </div>
          </motion.div>

          <motion.div
            variants={cardIn}
            className={`lg:col-span-6 rounded-2xl border border-[#3a3f4b] bg-[#1f2430]/65 p-6 ${glowRing}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-[#f5f6f8]">
                  ROOFZEUS
                </div>
                <div className="mt-1 text-[12px] text-white/55">
                  Built for roofing contractors
                </div>
              </div>
              <span className="rounded-full border border-[#cfae5d]/25 bg-[#cfae5d]/10 px-3 py-1 text-[11px] text-[#cfae5d]">
                14-day free trial
              </span>
            </div>

            <div className="mt-5 flex items-end gap-2">
              <div className="text-4xl font-bold text-[#f5f6f8]">
                ${priceMonthly}
              </div>
              <div className="pb-1 text-sm text-white/55">/ month</div>
            </div>

            <div className="mt-4 space-y-2 text-sm text-white/70">
              {[
                "Jobs + scheduling pipeline",
                "Crew invites + assignments",
                "Payout tracking + pay stubs",
                "Materials & receipts",
                "Notes & photos on every job",
              ].map((t) => (
                <div key={t} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#cfae5d]" />
                  <span>{t}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setSignupOpen(true)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#cfae5d] px-5 py-3 text-sm font-semibold text-black hover:bg-[#cfae5d]/90"
              >
                Start free trial
                <ArrowRight className="h-4 w-4" />
              </button>

              <Link
                to="/"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#3a3f4b] bg-white/5 px-5 py-3 text-sm font-semibold text-[#f5f6f8] hover:bg-white/10"
              >
                Back to home
              </Link>
            </div>

            <div className="mt-3 text-[11px] text-white/45">
              Trial ends after 14 days. You’ll be prompted to add payment to
              continue — nothing is charged automatically.
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* FINAL CTA */}
      <section className="max-w-7xl mx-auto px-6 pb-20">
        <motion.div
          variants={cardIn}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="relative overflow-hidden rounded-2xl border border-[#3a3f4b] bg-[#0b0e14]/45 p-7"
        >
          <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#cfae5d]/10 blur-3xl" />

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="text-2xl font-bold">
                Try it with real jobs this week.
              </div>
              <div className="mt-2 text-white/65 max-w-2xl">
                Create your company workspace, invite your crew, and run a full
                schedule + payout cycle during the trial. No payment info needed
                to start.
              </div>
            </div>

            <button
              onClick={() => setSignupOpen(true)}
              className="inline-flex md:hidden items-center justify-center gap-2 rounded-xl bg-[#cfae5d] px-5 py-3 text-sm font-semibold text-black hover:bg-[#cfae5d]/90"
            >
              Try now
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
