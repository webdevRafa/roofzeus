// src/pages/SignupPage.tsx
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import {
  CheckCircle2,
  ArrowRight,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";
import { signupContractorWithEmail } from "../firebase/signupContractor";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";

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

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[12px] text-white/70">{label}</div>
        {hint ? <div className="text-[11px] text-white/35">{hint}</div> : null}
      </div>
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

export default function SignupPage() {
  const navigate = useNavigate();

  const [draft, setDraft] = useState({
    fullName: "",
    email: "",
    password: "",
    userPhone: "",

    companyName: "",
    companyLegalName: "",
    companyPhone: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  const canSubmit = useMemo(() => {
    const emailOk = draft.email.trim().includes("@");
    const pwOk = draft.password.trim().length >= 6;
    const nameOk = draft.fullName.trim().length >= 2;
    const orgOk = draft.companyName.trim().length >= 2;
    return emailOk && pwOk && nameOk && orgOk && !submitting;
  }, [draft, submitting]);

  async function onSubmit() {
    setError(null);
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      // If someone is already signed in, clear session + org selection before creating a new account
      if (auth.currentUser) {
        localStorage.removeItem("rr_activeOrgId");
        await signOut(auth);
      }

      await signupContractorWithEmail({
        fullName: draft.fullName,
        email: draft.email,
        password: draft.password,
        userPhone: draft.userPhone,

        companyName: draft.companyName,
        companyLegalName: draft.companyLegalName,
        companyPhone: draft.companyPhone,
      });

      navigate("/dashboard", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0e14] text-[#f5f6f8]">
      {/* subtle background glow */}
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-24 left-1/2 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-[#cfae5d]/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto w-[min(1100px,94vw)] py-10">
        <motion.div variants={stagger} initial="hidden" animate="show">
          {/* header */}
          <motion.div
            variants={fadeUp}
            className="flex items-center justify-between"
          >
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full border border-[#3a3f4b] bg-white/5 px-3 py-1.5 text-[12px] text-white/75 hover:bg-white/10"
            >
              Already have an account?
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>

          {/* body */}
          <div className="mt-6 grid gap-4 md:grid-cols-5">
            {/* left rail */}
            <motion.div
              variants={cardIn}
              className="md:col-span-2 rounded-3xl border border-[#3a3f4b] bg-[#1f2430]/55 p-6"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-[#3a3f4b] bg-[#0b0e14]/55 px-2.5 py-1 text-[11px] text-[#cfae5d]/80">
                <ShieldCheck className="h-4 w-4" />
                No payment info required
              </div>

              <div className="mt-4 space-y-3 text-sm text-white/70">
                {[
                  "Create jobs, schedule stages, and track profit without spreadsheets.",
                  "Invite your crew, assign jobs, and generate pay stubs when you pay out.",
                  "Everything is scoped per company. Your workspace stays clean as you grow.",
                ].map((t) => (
                  <div key={t} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#cfae5d]" />
                    <div className="leading-relaxed">{t}</div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-[#cfae5d]/25 bg-[#cfae5d]/10 p-4">
                <div className="text-[12px] font-semibold text-[#cfae5d]">
                  Created instantly
                </div>
                <div className="mt-2 text-[12px] text-white/70 leading-relaxed">
                  We create your organization, user profile, employee profile,
                  and an
                  <span className="text-white/85"> active membership</span>{" "}
                  linking you to your company — in one transaction.
                </div>
              </div>
            </motion.div>

            {/* form */}
            <motion.div
              variants={cardIn}
              className="md:col-span-3 rounded-3xl border border-[#3a3f4b] bg-[#0b0e14]/55 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.55)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">
                    Create your account
                  </div>
                  <div className="mt-1 text-[12px] text-white/60">
                    After 14 days, continue for{" "}
                    <span className="text-white/80">$59/mo</span> (flat). Cancel
                    anytime.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#3a3f4b] bg-white/5 hover:bg-white/10"
                  aria-label="Close"
                >
                  <X className="h-4 w-4 text-white/70" />
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Field
                  label="Your full name"
                  value={draft.fullName}
                  onChange={(v) => set("fullName", v)}
                  placeholder="e.g. Rafael Castro"
                  autoComplete="name"
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
                  label="Password"
                  value={draft.password}
                  onChange={(v) => set("password", v)}
                  type="password"
                  placeholder="Minimum 6 characters"
                  autoComplete="new-password"
                  hint="Use a manager"
                />
                <Field
                  label="Your phone (optional)"
                  value={draft.userPhone}
                  onChange={(v) => set("userPhone", v)}
                  placeholder="(210) 555-0123"
                  autoComplete="tel"
                />

                <Field
                  label="Company name"
                  value={draft.companyName}
                  onChange={(v) => set("companyName", v)}
                  placeholder="e.g. Roger’s Roofing"
                  autoComplete="organization"
                />
                <Field
                  label="Company phone (optional)"
                  value={draft.companyPhone}
                  onChange={(v) => set("companyPhone", v)}
                  placeholder="(210) 555-0456"
                  autoComplete="tel"
                />

                <div className="sm:col-span-2">
                  <Field
                    label="Company legal name (optional)"
                    value={draft.companyLegalName}
                    onChange={(v) => set("companyLegalName", v)}
                    placeholder="If different from company name"
                    autoComplete="organization"
                    hint="For invoices/stubs"
                  />
                </div>
              </div>

              {error ? (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-100">
                  {error}
                </div>
              ) : null}

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-[11px] text-white/45 leading-relaxed">
                  By continuing, you agree to reasonable terms. No spam.
                </div>

                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={!canSubmit}
                  className={[
                    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold",
                    "bg-[#cfae5d] text-[#0b0e14] hover:brightness-95",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  ].join(" ")}
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
                After signup, you’ll land in your dashboard. You can invite
                teammates anytime.
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
