import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { signOut } from "firebase/auth";
import logo from "../assets/rz-modern-white.svg";
import { auth } from "../firebase/firebaseConfig";
import { signupContractorWithEmail } from "../firebase/signupContractor";

type Draft = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  userPhone: string;
  companyName: string;
  companyLegalName: string;
  companyPhone: string;
  companyState: string;
};

const STATE_OPTIONS = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
] as const;

const steps = [
  {
    label: "Your details",
    title: "Start with you.",
    copy: "Add your name and work email.",
  },
  {
    label: "Secure access",
    title: "Create a strong password.",
    copy: "Protect your company workspace.",
  },
  {
    label: "Your company",
    title: "Add your company.",
    copy: "Create the workspace your business will use.",
  },
  {
    label: "Review",
    title: "Review and create.",
    copy: "Check the details, then start your trial.",
  },
] as const;

function marketingOrigin() {
  const host = window.location.hostname.toLowerCase();
  if (host === "app.localhost") return "http://localhost:5173";
  if (host.endsWith(".vercel.app")) return "https://roofzeus.vercel.app";
  return "https://www.roofzeus.com";
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function passwordScore(password: string) {
  return [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  className = "",
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  className?: string;
  optional?: boolean;
}) {
  return (
    <label className={`rz-auth-field ${className}`}>
      <span className="rz-auth-field__label">
        {label}
        {optional ? " · Optional" : ""}
      </span>
      <input
        className="rz-auth-input"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
    </label>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  placeholder: string;
}) {
  return (
    <label className="rz-auth-field rz-signup-fields__full">
      <span className="rz-auth-field__label">{label}</span>
      <span className="rz-auth-input-wrap">
        <input
          className="rz-auth-input"
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
          style={{ paddingLeft: 14, paddingRight: 46 }}
        />
        <button
          className="rz-password-toggle"
          type="button"
          onClick={onToggle}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </span>
    </label>
  );
}

export default function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    userPhone: "",
    companyName: "",
    companyLegalName: "",
    companyPhone: "",
    companyState: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const score = useMemo(
    () => passwordScore(draft.password),
    [draft.password]
  );
  const phoneValid = (value: string) => {
    const length = value.replace(/\D/g, "").length;
    return length === 0 || length === 10;
  };

  const stepValid = useMemo(() => {
    if (step === 0) {
      return (
        draft.fullName.trim().length >= 2 &&
        /^\S+@\S+\.\S+$/.test(draft.email.trim())
      );
    }
    if (step === 1) {
      return (
        score === 4 &&
        draft.confirmPassword.length > 0 &&
        draft.password === draft.confirmPassword
      );
    }
    if (step === 2) {
      return (
        draft.companyName.trim().length >= 2 &&
        draft.companyState.length === 2 &&
        phoneValid(draft.companyPhone)
      );
    }
    return phoneValid(draft.userPhone);
  }, [draft, score, step]);

  function nextStep() {
    setError(null);
    if (!stepValid) {
      const message =
        step === 0
          ? "Enter your full name and a valid work email."
          : step === 1
          ? "Use a password with 8+ characters, uppercase, number, and symbol. Both passwords must match."
          : step === 2
          ? "Enter your company name, state, and a valid phone number if provided."
          : "Enter a valid 10-digit phone number or leave it blank.";
      setError(message);
      return;
    }
    setStep((current) => Math.min(3, current + 1));
  }

  async function createAccount() {
    setError(null);
    if (!stepValid) {
      setError("Check the optional phone number before creating your account.");
      return;
    }

    setSubmitting(true);
    try {
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
        companyState: draft.companyState,
      });
      navigate("/verify-email", { replace: true });
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "We could not create the account. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const current = steps[step];
  const strengthLabel = ["Start typing", "Weak", "Fair", "Good", "Strong"][
    score
  ];

  return (
    <main className="rz-auth-page rz-signup-page">
      <div className="rz-auth-shell">
        <section className="rz-auth-story">
          <a href={marketingOrigin()} aria-label="Visit the Roof Zeus website">
            <img className="rz-auth-story__logo" src={logo} alt="Roof Zeus" />
          </a>
          <div>
            <h1>Start with one clear workspace.</h1>
            <p>
              Add your jobs and team when you are ready. No card required.
            </p>
            <div className="rz-auth-story__proof">
              <span>
                <CheckCircle2 aria-hidden="true" />
                30 days free
              </span>
              <span>
                <CheckCircle2 aria-hidden="true" />
                Every feature included
              </span>
              <span>
                <CheckCircle2 aria-hidden="true" />
                Cancel anytime
              </span>
            </div>
          </div>
        </section>

        <section className="rz-auth-form-panel">
          <div className="rz-auth-form-panel__head">
            <div>
              <h2>{current.title}</h2>
              <p>{current.copy}</p>
            </div>
            <a className="rz-auth-back" href={marketingOrigin()}>
              Website
            </a>
          </div>

          <div className="rz-signup-progress">
            <div className="rz-signup-progress__meta">
              <span>{current.label}</span>
              <strong>Step {step + 1} of 4</strong>
            </div>
            <div
              className="rz-signup-progress__track"
              role="progressbar"
              aria-label="Account setup progress"
              aria-valuemin={1}
              aria-valuemax={4}
              aria-valuenow={step + 1}
            >
              <motion.div
                className="rz-signup-progress__bar"
                animate={{ width: `${((step + 1) / 4) * 100}%` }}
              />
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              className="rz-signup-fields"
              key={step}
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.18 }}
            >
              {step === 0 ? (
                <>
                  <Field
                    className="rz-signup-fields__full"
                    label="Full name"
                    value={draft.fullName}
                    onChange={(value) => update("fullName", value)}
                    placeholder="Your full name"
                    autoComplete="name"
                  />
                  <Field
                    className="rz-signup-fields__full"
                    label="Work email"
                    value={draft.email}
                    onChange={(value) => update("email", value)}
                    type="email"
                    placeholder="you@company.com"
                    autoComplete="email"
                  />
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <PasswordField
                    label="Password"
                    value={draft.password}
                    onChange={(value) => update("password", value)}
                    visible={showPassword}
                    onToggle={() => setShowPassword((value) => !value)}
                    placeholder="Create a strong password"
                  />
                  <div className="rz-password-strength rz-signup-fields__full">
                    <span>Password strength: {strengthLabel}</span>
                    <div className="rz-password-strength__bar">
                      <span style={{ width: `${Math.max(4, score * 25)}%` }} />
                    </div>
                    <span>
                      8+ characters with an uppercase letter, number, and
                      symbol.
                    </span>
                  </div>
                  <PasswordField
                    label="Confirm password"
                    value={draft.confirmPassword}
                    onChange={(value) => update("confirmPassword", value)}
                    visible={showConfirm}
                    onToggle={() => setShowConfirm((value) => !value)}
                    placeholder="Enter it again"
                  />
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <Field
                    label="Company name"
                    value={draft.companyName}
                    onChange={(value) => update("companyName", value)}
                    placeholder="Your roofing company"
                    autoComplete="organization"
                  />
                  <label className="rz-auth-field">
                    <span className="rz-auth-field__label">
                      Primary company state
                    </span>
                    <select
                      className="rz-auth-select"
                      value={draft.companyState}
                      onChange={(event) =>
                        update("companyState", event.target.value)
                      }
                    >
                      <option value="">Select a state</option>
                      {STATE_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label="Company phone"
                    value={draft.companyPhone}
                    onChange={(value) =>
                      update("companyPhone", formatPhone(value))
                    }
                    placeholder="(210) 555-0456"
                    autoComplete="tel"
                    optional
                  />
                  <Field
                    label="Company legal name"
                    value={draft.companyLegalName}
                    onChange={(value) => update("companyLegalName", value)}
                    placeholder="If different from company name"
                    autoComplete="organization"
                    optional
                  />
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <Field
                    className="rz-signup-fields__full"
                    label="Your phone"
                    value={draft.userPhone}
                    onChange={(value) =>
                      update("userPhone", formatPhone(value))
                    }
                    placeholder="(210) 555-0123"
                    autoComplete="tel"
                    optional
                  />
                  <div className="rz-signup-review">
                    {[
                      ["Name", draft.fullName],
                      ["Work email", draft.email],
                      ["Company", draft.companyName],
                      ["Primary state", draft.companyState],
                      ["Company phone", draft.companyPhone || "Not provided"],
                      ["Your phone", draft.userPhone || "Not provided"],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </motion.div>
          </AnimatePresence>

          {error ? (
            <div className="rz-auth-error" role="alert">
              {error}
            </div>
          ) : null}

          <div className="rz-signup-controls">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep((currentStep) => Math.max(0, currentStep - 1));
                }}
              >
                <ArrowLeft aria-hidden="true" />
                Back
              </button>
            ) : (
              <span />
            )}

            {step < 3 ? (
              <button type="button" onClick={nextStep}>
                Continue
                <ArrowRight aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={createAccount}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    Creating account…
                  </>
                ) : (
                  <>
                    Create account
                    <ArrowRight aria-hidden="true" />
                  </>
                )}
              </button>
            )}
          </div>

          <p className="rz-auth-terms">
            By creating an account, you agree to the{" "}
            <a href={`${marketingOrigin()}/terms`}>terms of service</a> and{" "}
            <a href={`${marketingOrigin()}/privacy`}>privacy policy</a>. Already
            have an account?{" "}
            <Link to="/login">Sign in</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}
