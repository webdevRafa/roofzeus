// src/pages/VerifyEmailPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import { getAuth, sendEmailVerification } from "firebase/auth";
import { Mail, RefreshCcw, ShieldCheck, ArrowRight } from "lucide-react";

// Match the motion + visual language you’re using in HomePage.tsx :contentReference[oaicite:0]{index=0}
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

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const onChange = () => setReduced(!!mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

export default function VerifyEmailPage() {
  const auth = useMemo(() => getAuth(), []);
  const nav = useNavigate();
  const loc = useLocation();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{
    kind: "info" | "success" | "error";
    text: string;
  } | null>(null);

  const [email, setEmail] = useState<string | null>(
    auth.currentUser?.email ?? null
  );

  const mountedRef = useRef(true);
  const timerRef = useRef<number | null>(null);
  const lastCheckAtRef = useRef<number>(0);

  // If user is already verified, go straight in.
  useEffect(() => {
    mountedRef.current = true;
    const u = auth.currentUser;
    if (u?.email) setEmail(u.email);

    if (u?.emailVerified) {
      nav("/dashboard", { replace: true });
    }

    return () => {
      mountedRef.current = false;
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [auth, nav]);

  async function checkVerified() {
    const u = auth.currentUser;
    if (!u) return false;

    // Basic throttling guard (helps avoid excessive reload spam)
    const now = Date.now();
    if (now - lastCheckAtRef.current < 900) return u.emailVerified;
    lastCheckAtRef.current = now;

    try {
      await u.reload();
      if (!mountedRef.current) return false;

      if (u.emailVerified) {
        setStatus({
          kind: "success",
          text: "Email verified. Redirecting…",
        });
        nav("/dashboard", { replace: true });
        return true;
      }
      return false;
    } catch {
      // Swallow transient errors; page will keep trying.
      return false;
    }
  }

  // Auto-check loop (poll) — routes instantly once verified
  useEffect(() => {
    if (prefersReducedMotion) return;

    // Run immediately, then poll
    void checkVerified();

    timerRef.current = window.setInterval(() => {
      void checkVerified();
    }, 2500);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion]);

  async function onResend() {
    const u = auth.currentUser;
    if (!u) {
      setStatus({
        kind: "error",
        text: "You’re not signed in. Please sign in again to resend verification.",
      });
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      await sendEmailVerification(u, {
        url: `${window.location.origin}/verify-email`,
        handleCodeInApp: false,
      });

      if (!mountedRef.current) return;

      setStatus({
        kind: "info",
        text: "Verification email sent. Check your inbox (and spam/junk).",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send email.";
      setStatus({ kind: "error", text: msg });
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  async function onRefreshStatus() {
    setBusy(true);
    setStatus(null);
    try {
      const ok = await checkVerified();
      if (!ok && mountedRef.current) {
        setStatus({
          kind: "info",
          text: "Not verified yet. If you just clicked the link, wait a second and try again.",
        });
      }
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  const pillStyles =
    status?.kind === "success"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
      : status?.kind === "error"
      ? "border-red-500/20 bg-red-500/10 text-red-200"
      : "border-white/10 bg-white/5 text-white/75";

  return (
    <main className="min-h-screen bg-[#0b0e14] text-[#f5f6f8] overflow-x-hidden">
      {/* background texture like HomePage hero */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(207,174,93,0.10),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.05),transparent_55%)]" />
      </div>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative max-w-7xl mx-auto px-6 pt-24 pb-16"
      >
        <motion.div variants={fadeUp} className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[12px] text-white/60 hover:text-white/80 transition"
          >
            <span className="h-2 w-2 rounded-full bg-[#cfae5d]/80" />
            ROOFZEUS
          </Link>
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Left copy */}
          <motion.div variants={fadeUp} className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#cfae5d]/35 bg-[#cfae5d]/10 px-3 py-1 text-[12px] text-white">
              <ShieldCheck className="h-4 w-4 text-[#cfae5d]" />
              Verification required
            </div>

            <h1 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight text-white leading-[1.05]">
              Verify your email to unlock the dashboard.
            </h1>

            <p className="mt-4 text-white/75 max-w-xl leading-relaxed">
              We sent a verification link to{" "}
              <span className="text-white/90 font-semibold">
                {email ?? "your email"}
              </span>
              . Once you click it, this page will automatically continue.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-[#3a3f4b] bg-[#0b0e14]/50 px-3 py-1 text-[12px] text-white/65">
                Helps prevent bot abuse
              </span>
              <span className="inline-flex items-center rounded-full border border-[#3a3f4b] bg-[#0b0e14]/50 px-3 py-1 text-[12px] text-white/65">
                Keeps Firestore clean
              </span>
            </div>

            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <motion.button
                type="button"
                whileHover={{ y: -1, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                disabled={busy}
                onClick={onRefreshStatus}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#3a3f4b] bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:border-[#cfae5d] hover:bg-white/10 transition disabled:opacity-60"
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh status
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ y: -1, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                disabled={busy}
                onClick={onResend}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#cfae5d] px-5 py-2.5 text-sm font-semibold text-black hover:opacity-90 transition disabled:opacity-60"
              >
                <Mail className="h-4 w-4" />
                Resend email
              </motion.button>
            </div>

            <div className="mt-6 text-[12px] text-white/55">
              Tip: check spam/junk, and if you verified on your phone, keep this
              tab open — it will redirect automatically.
            </div>
          </motion.div>

          {/* Right card */}
          <motion.div
            variants={cardIn}
            initial="hidden"
            animate="show"
            className="lg:col-span-6"
          >
            <div className="relative overflow-hidden rounded-2xl border border-[#3a3f4b] bg-[#1f2430] shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
              {/* ambient glow */}
              <div className="pointer-events-none absolute -top-28 -right-28 h-72 w-72 rounded-full bg-[#cfae5d]/12 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-28 -left-28 h-72 w-72 rounded-full bg-white/6 blur-3xl" />

              <div className="relative border-b border-[#3a3f4b] px-5 py-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#f5f6f8] truncate">
                    Waiting for verification
                  </div>
                  <div className="text-[12px] text-[#cfae5d]/70 truncate">
                    This page auto-checks every few seconds
                  </div>
                </div>

                <div className="inline-flex items-center rounded-full border border-[#3a3f4b] bg-[#0b0e14]/40 px-3 py-1 text-[11px] text-white/70">
                  Secure onboarding
                </div>
              </div>

              <div className="relative p-5">
                {status ? (
                  <div
                    className={`rounded-xl border px-4 py-3 text-[13px] ${pillStyles}`}
                  >
                    {status.text}
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[13px] text-white/75">
                    We’ll redirect automatically once your email is verified.
                  </div>
                )}

                <div className="mt-5 grid gap-3">
                  <div className="rounded-xl border border-[#3a3f4b] bg-[#0b0e14]/35 p-4">
                    <div className="text-[11px] uppercase tracking-wide text-white/50">
                      Step 1
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white/85">
                      Open the verification email
                    </div>
                    <div className="mt-1 text-[12px] text-white/55">
                      Subject usually includes “Verify” or “Email address”.
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#3a3f4b] bg-[#0b0e14]/35 p-4">
                    <div className="text-[11px] uppercase tracking-wide text-white/50">
                      Step 2
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white/85">
                      Click the link
                    </div>
                    <div className="mt-1 text-[12px] text-white/55">
                      You can do this on any device.
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#3a3f4b] bg-[#0b0e14]/35 p-4">
                    <div className="text-[11px] uppercase tracking-wide text-white/50">
                      Step 3
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white/85">
                      Return here — we’ll continue
                    </div>
                    <div className="mt-1 text-[12px] text-white/55">
                      Or press “Refresh status” if needed.
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between gap-3">
                  <Link
                    to="/login"
                    state={{ from: loc.pathname }}
                    className="text-[12px] text-white/60 hover:text-white/80 transition"
                  >
                    Having trouble? Sign in again
                  </Link>

                  <div className="inline-flex items-center gap-2 text-[12px] text-[#cfae5d]/80">
                    <span>Continue</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>

                {/* top accent line */}
                <div className="pointer-events-none absolute left-6 right-6 top-0 h-[1px] bg-[#cfae5d]/20" />
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </main>
  );
}
