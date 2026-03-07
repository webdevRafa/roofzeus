// src/pages/SignupPage.tsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { signupContractorWithEmail } from "../firebase/signupContractor";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import logo from "../assets/logo-white.svg";
const ease = [0.16, 1, 0.3, 1] as const;

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.06 } },
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

// Same scoring concept as CompleteSignupPage: 0..4
function passwordScore(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

function strengthLabel(score: number) {
  if (score <= 1) return "Weak";
  if (score === 2) return "Fair";
  if (score === 3) return "Good";
  return "Strong";
}

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

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[12px] text-white/70">{label}</div>
        {hint ? <div className="text-[11px] text-white/35">{hint}</div> : null}
      </div>

      <div className="relative">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          autoComplete="new-password"
          className="w-full rounded-xl border border-[#3a3f4b] bg-[#0b0e14]/55 px-3 py-2 pr-10 text-sm text-[#f5f6f8] placeholder:text-white/35 outline-none focus:border-[#cfae5d]/45 focus:ring-2 focus:ring-[#cfae5d]/10"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-white/60 hover:bg-white/5 hover:text-white/80"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}
function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function phoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

const stepPanel: Variants = {
  enter: { opacity: 0, x: 20, filter: "blur(6px)" },
  center: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: { duration: 0.28, ease },
  },
  exit: {
    opacity: 0,
    x: -20,
    filter: "blur(6px)",
    transition: { duration: 0.22, ease },
  },
};

const SIGNUP_STEPS = [
  {
    id: 1,
    eyebrow: "Step 1 of 4",
    title: "Let's start with you",
    desc: "Your name and work email.",
  },
  {
    id: 2,
    eyebrow: "Step 2 of 4",
    title: "Secure your account",
    desc: "Create a strong password.",
  },
  {
    id: 3,
    eyebrow: "Step 3 of 4",
    title: "Tell us about your company",
    desc: "Basic business details for your workspace.",
  },
  {
    id: 4,
    eyebrow: "Step 4 of 4",
    title: "Finish setup",
    desc: "Optional phone and quick review before creating your account.",
  },
] as const;

export default function SignupPage() {
  function marketingOrigin() {
    const host = window.location.hostname.toLowerCase();

    // local dev from app.localhost -> marketing localhost
    if (host === "app.localhost") return "http://localhost:5173";

    // vercel preview/prod on vercelapp
    if (host.endsWith(".vercel.app")) return "https://roofzeus.vercel.app";

    // custom domain
    return "https://www.roofzeus.com";
  }

  const navigate = useNavigate();

  const [draft, setDraft] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    userPhone: "",

    companyName: "",
    companyLegalName: "",
    companyPhone: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  function set<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  const score = useMemo(() => passwordScore(draft.password), [draft.password]);

  const pwReq = useMemo(() => {
    const pw = draft.password;
    return {
      len: pw.length >= 8,
      upper: /[A-Z]/.test(pw),
      number: /[0-9]/.test(pw),
      symbol: /[^A-Za-z0-9]/.test(pw),
    };
  }, [draft.password]);

  const passwordsMatch = useMemo(() => {
    if (!draft.confirmPassword) return true; // don’t scream until they start typing
    return draft.password === draft.confirmPassword;
  }, [draft.password, draft.confirmPassword]);

  const emailOk = useMemo(
    () => draft.email.trim().includes("@"),
    [draft.email]
  );
  const nameOk = useMemo(
    () => draft.fullName.trim().length >= 2,
    [draft.fullName]
  );
  const orgOk = useMemo(
    () => draft.companyName.trim().length >= 2,
    [draft.companyName]
  );

  // ✅ Require strong password + match
  const pwOk = useMemo(() => score === 4, [score]);

  const userPhoneOk = useMemo(() => {
    const digits = phoneDigits(draft.userPhone);
    return digits.length === 0 || digits.length === 10;
  }, [draft.userPhone]);

  const companyPhoneOk = useMemo(() => {
    const digits = phoneDigits(draft.companyPhone);
    return digits.length === 0 || digits.length === 10;
  }, [draft.companyPhone]);

  const canSubmit = useMemo(() => {
    return (
      emailOk &&
      nameOk &&
      orgOk &&
      pwOk &&
      userPhoneOk &&
      companyPhoneOk &&
      draft.password === draft.confirmPassword &&
      !submitting
    );
  }, [
    emailOk,
    nameOk,
    orgOk,
    pwOk,
    userPhoneOk,
    companyPhoneOk,
    draft.password,
    draft.confirmPassword,
    submitting,
  ]);

  const step1Ok = useMemo(() => nameOk && emailOk, [nameOk, emailOk]);
  const step2Ok = useMemo(
    () => pwOk && draft.password === draft.confirmPassword,
    [pwOk, draft.password, draft.confirmPassword]
  );
  const step3Ok = useMemo(
    () => orgOk && companyPhoneOk,
    [orgOk, companyPhoneOk]
  );

  const progressPercent = useMemo(() => (step / 4) * 100, [step]);

  const currentStepMeta = SIGNUP_STEPS[step - 1];

  function goBackStep() {
    setError(null);
    setStep((prev) => Math.max(1, prev - 1) as 1 | 2 | 3 | 4);
  }

  function goNextStep() {
    setError(null);

    if (step === 1 && !step1Ok) {
      setError("Please enter your full name and a valid work email.");
      return;
    }

    if (step === 2 && !step2Ok) {
      if (!pwOk) {
        setError("Please use a stronger password before continuing.");
      } else {
        setError("Passwords do not match.");
      }
      return;
    }

    if (step === 3 && !step3Ok) {
      if (!orgOk) {
        setError("Please enter your company name.");
      } else if (!companyPhoneOk) {
        setError("Please enter a valid 10-digit company phone number.");
      }
      return;
    }

    setStep((prev) => Math.min(4, prev + 1) as 1 | 2 | 3 | 4);
  }

  function strongPasswordMessage() {
    // only show guidance once they interact
    if (!draft.password)
      return "A strong password consists of 8+ characters with at least one uppercase, one number, symbol.";
    if (score === 4) return "Strong password.";
    return "Make it stronger: add missing requirements below.";
  }

  async function onSubmit() {
    setError(null);
    if (!canSubmit) {
      if (!pwOk) {
        setError("Please use a stronger password before continuing.");
      } else if (draft.password !== draft.confirmPassword) {
        setError("Passwords do not match.");
      } else if (!userPhoneOk) {
        setError("Please enter a valid 10-digit phone number.");
      } else if (!companyPhoneOk) {
        setError("Please enter a valid 10-digit company phone number.");
      }
      return;
    }

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

      navigate("/verify-email", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0e14] text-[#f5f6f8]">
      <img className="w-[220px] mx-auto mt-20" src={logo} alt="" />
      <div className="relative mx-auto w-full py-10 px-4">
        <motion.div variants={stagger} initial="hidden" animate="show">
          {/* header */}

          {/* body */}
          <div className="max-w-2xl mx-auto ">
            <a
              href={marketingOrigin()}
              className="inline-flex items-center text-sm text-white/65 hover:text-white mb-3 ml-3"
            >
              Back to home
            </a>
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
                    No card is needed to get started.
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

              <div className="mt-5">
                {/* step header */}
                <div className="mb-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[#cfae5d]/85">
                        {currentStepMeta.eyebrow}
                      </div>
                      <div className="mt-1 text-base font-semibold text-white">
                        {currentStepMeta.title}
                      </div>
                      <div className="mt-1 text-[12px] text-white/55">
                        {currentStepMeta.desc}
                      </div>
                    </div>

                    <div className="hidden sm:flex items-center gap-2">
                      {SIGNUP_STEPS.map((s) => {
                        const active = s.id === step;
                        const complete = s.id < step;

                        return (
                          <div
                            key={s.id}
                            className={cx(
                              "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition",
                              complete &&
                                "border-[#cfae5d]/50 bg-[#cfae5d]/15 text-[#f5e2a4]",
                              active &&
                                "border-[#cfae5d] bg-[#cfae5d]/20 text-white",
                              !complete &&
                                !active &&
                                "border-white/10 bg-white/5 text-white/45"
                            )}
                          >
                            {complete ? <Check className="h-4 w-4" /> : s.id}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/5">
                    <motion.div
                      initial={false}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ duration: 0.28, ease }}
                      className="h-full rounded-full bg-[#cfae5d]"
                    />
                  </div>
                </div>

                {/* step body */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    variants={stepPanel}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    {step === 1 && (
                      <>
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
                      </>
                    )}

                    {step === 2 && (
                      <>
                        <div className="sm:col-span-2">
                          <PasswordField
                            label="Password"
                            value={draft.password}
                            onChange={(v) => set("password", v)}
                            show={showPw}
                            onToggleShow={() => setShowPw((v) => !v)}
                            placeholder="8+ chars, uppercase, number, symbol"
                            hint={draft.password ? strengthLabel(score) : ""}
                          />

                          <motion.div
                            initial={false}
                            animate={{ opacity: draft.password ? 1 : 0.95 }}
                            className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-white/50">
                                Password strength
                              </span>
                              <span className="text-[11px] text-white/70">
                                {strengthLabel(score)}
                              </span>
                            </div>

                            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/5">
                              <div
                                className={cx(
                                  "h-full rounded-full transition-all duration-300",
                                  score === 0 && "w-[5%] bg-red-500/35",
                                  score === 1 && "w-[25%] bg-red-500/45",
                                  score === 2 && "w-[50%] bg-amber-500/55",
                                  score === 3 && "w-[75%] bg-emerald-500/45",
                                  score === 4 && "w-[100%] bg-emerald-500/65"
                                )}
                              />
                            </div>

                            <div className="mt-2 text-[11px] text-white/45">
                              {strongPasswordMessage()}
                            </div>

                            <ul className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-white/45 max-w-[200px]">
                              <li className={cx(pwReq.len && "text-white/80")}>
                                • 8+ characters
                              </li>
                              <li
                                className={cx(pwReq.upper && "text-white/80")}
                              >
                                • 1 uppercase
                              </li>
                              <li
                                className={cx(pwReq.number && "text-white/80")}
                              >
                                • 1 number
                              </li>
                              <li
                                className={cx(pwReq.symbol && "text-white/80")}
                              >
                                • 1 symbol
                              </li>
                            </ul>
                          </motion.div>
                        </div>

                        <div className="sm:col-span-2">
                          <PasswordField
                            label="Confirm password"
                            value={draft.confirmPassword}
                            onChange={(v) => set("confirmPassword", v)}
                            show={showConfirm}
                            onToggleShow={() => setShowConfirm((v) => !v)}
                            placeholder="Re-enter your password"
                            hint={
                              draft.confirmPassword
                                ? passwordsMatch
                                  ? "Matches"
                                  : "Doesn’t match"
                                : undefined
                            }
                          />
                          {!passwordsMatch &&
                          draft.confirmPassword.length > 0 ? (
                            <div className="mt-2 text-[12px] text-red-200">
                              Passwords don’t match.
                            </div>
                          ) : null}
                        </div>
                      </>
                    )}

                    {step === 3 && (
                      <>
                        <Field
                          label="Company name"
                          value={draft.companyName}
                          onChange={(v) => set("companyName", v)}
                          placeholder="e.g. Roger’s Roofing"
                          autoComplete="organization"
                        />

                        <div>
                          <Field
                            label="Company phone (optional)"
                            value={draft.companyPhone}
                            onChange={(v) =>
                              set("companyPhone", formatPhone(v))
                            }
                            placeholder="(210) 555-0456"
                            autoComplete="tel"
                          />
                          {draft.companyPhone && !companyPhoneOk ? (
                            <div className="mt-2 text-[12px] text-red-200">
                              Enter a full 10-digit phone number.
                            </div>
                          ) : null}
                        </div>

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
                      </>
                    )}

                    {step === 4 && (
                      <>
                        <div>
                          <Field
                            label="Your phone (optional)"
                            value={draft.userPhone}
                            onChange={(v) => set("userPhone", formatPhone(v))}
                            placeholder="(210) 555-0123"
                            autoComplete="tel"
                          />
                          {draft.userPhone && !userPhoneOk ? (
                            <div className="mt-2 text-[12px] text-red-200">
                              Enter a full 10-digit phone number.
                            </div>
                          ) : null}
                        </div>

                        <div className="sm:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="text-sm font-semibold text-white">
                            Review your workspace
                          </div>

                          <div className="mt-3 grid gap-3 sm:grid-cols-2 text-[13px]">
                            <div>
                              <div className="text-white/45">Full name</div>
                              <div className="mt-1 text-white/85">
                                {draft.fullName || "—"}
                              </div>
                            </div>

                            <div>
                              <div className="text-white/45">Work email</div>
                              <div className="mt-1 text-white/85">
                                {draft.email || "—"}
                              </div>
                            </div>

                            <div>
                              <div className="text-white/45">Company name</div>
                              <div className="mt-1 text-white/85">
                                {draft.companyName || "—"}
                              </div>
                            </div>

                            <div>
                              <div className="text-white/45">
                                Company legal name
                              </div>
                              <div className="mt-1 text-white/85">
                                {draft.companyLegalName ||
                                  "Same as company name"}
                              </div>
                            </div>

                            <div>
                              <div className="text-white/45">Your phone</div>
                              <div className="mt-1 text-white/85">
                                {draft.userPhone || "Not provided"}
                              </div>
                            </div>

                            <div>
                              <div className="text-white/45">Company phone</div>
                              <div className="mt-1 text-white/85">
                                {draft.companyPhone || "Not provided"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {error ? (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-100">
                  {error}
                </div>
              ) : null}

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-[11px] text-white/45 leading-relaxed">
                  By continuing, you agree to the terms & conditions.
                </div>

                <div className="flex items-center gap-2 self-end">
                  {step > 1 && (
                    <button
                      type="button"
                      onClick={goBackStep}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#3a3f4b] bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/70 hover:text-white cursor-pointer hover:bg-white/10"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </button>
                  )}

                  {step < 4 ? (
                    <button
                      type="button"
                      onClick={goNextStep}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border-1 border-[var(--color-blue)] px-4 py-2.5 text-sm font-semibold text-white/70 hover:text-white cursor-pointer hover:brightness-95"
                    >
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onSubmit}
                      disabled={!canSubmit}
                      className={[
                        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold",
                        "border-1 border-[var(--color-blue)] text-white/70 hover:text-white cursor-pointer ",
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
                  )}
                </div>
              </div>

              <div className="mt-3 text-[11px] text-white/40">
                After signup, you’ll land in your dashboard to begin using the
                service.
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
