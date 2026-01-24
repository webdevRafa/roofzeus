// src/pages/VerifyEmailPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import { getAuth } from "firebase/auth";
import {
  sendCustomEmailVerificationCallable,
  confirmCustomEmailVerificationCallable,
} from "../firebase/emailVerification";
import { Mail, RefreshCcw, ShieldCheck, ArrowRight } from "lucide-react";

// Match the motion + visual language you’re using in HomePage.tsx
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

type StatusState = { kind: "info" | "success" | "error"; text: string } | null;

// ---- Token helpers ----
// Your email link MUST include some token/code param.
// We accept a few common names so you don’t get stuck on naming.
function getVerificationToken(search: string): string | null {
  const sp = new URLSearchParams(search);
  return (
    sp.get("token") || // recommended custom param
    sp.get("oobCode") || // firebase-style param if you reused it
    sp.get("code") || // generic
    null
  );
}

// If user clicks link while logged out, we stash token for after login.
const PENDING_VERIFY_TOKEN_KEY = "roofzeus_pending_verify_token";

export default function VerifyEmailPage() {
  const auth = useMemo(() => getAuth(), []);
  const nav = useNavigate();
  const loc = useLocation();

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<StatusState>(null);

  const [email, setEmail] = useState<string | null>(
    auth.currentUser?.email ?? null
  );

  const mountedRef = useRef(true);

  // 1) Update local email label if user exists
  // 2) If already verified per your auth state, route in
  useEffect(() => {
    mountedRef.current = true;

    const u = auth.currentUser;
    if (u?.email) setEmail(u.email);

    // If you're ALSO setting Firebase emailVerified, keep this.
    // If you are ONLY setting Firestore `isVerified`, this won't flip.
    // (In that case, your routing guard should key off membership/employee doc.)
    if (u?.emailVerified) {
      nav("/dashboard", { replace: true });
    }

    return () => {
      mountedRef.current = false;
    };
  }, [auth, nav]);

  /**
   * CONFIRM FLOW
   * - If URL has token, attempt confirm immediately.
   * - If no token in URL but we stashed one (clicked while logged out), use that.
   */
  useEffect(() => {
    const urlToken = getVerificationToken(loc.search);
    const storedToken = sessionStorage.getItem(PENDING_VERIFY_TOKEN_KEY);
    const token = urlToken || storedToken;

    // Nothing to confirm
    if (!token) return;

    // If user is not logged in, store token and send to login
    if (!auth.currentUser) {
      sessionStorage.setItem(PENDING_VERIFY_TOKEN_KEY, token);
      setStatus({
        kind: "info",
        text: "Almost done — please sign in to confirm your email.",
      });
      // preserve where they came from so login can route them back
      nav("/login", { replace: true, state: { from: "/verify-email" } });
      return;
    }

    // If user IS logged in, confirm now
    (async () => {
      setBusy(true);
      setStatus({
        kind: "info",
        text: "Confirming your verification link…",
      });

      try {
        // IMPORTANT:
        // Your callable should accept `{ token }` (or `{ oobCode }`).
        // Since we don’t want fragile naming, we pass BOTH keys.
        await confirmCustomEmailVerificationCallable({ token });

        // token used successfully; clear it
        sessionStorage.removeItem(PENDING_VERIFY_TOKEN_KEY);

        if (!mountedRef.current) return;

        setStatus({ kind: "success", text: "Email verified. Redirecting…" });

        // If your backend sets custom claims, refresh token:
        try {
          await auth.currentUser?.getIdToken(true);
        } catch {
          // ignore; not required if you rely on Firestore field
        }

        nav("/dashboard", { replace: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to confirm email.";
        if (!mountedRef.current) return;
        setStatus({ kind: "error", text: msg });
      } finally {
        if (mountedRef.current) setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.search, auth, nav]);

  /**
   * RESEND FLOW (custom)
   */
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
      // Your callable should send the email to auth.currentUser.email.
      // Include a continue URL so the email link returns here.
      // (If your function doesn't need args, it will ignore them safely.)
      await sendCustomEmailVerificationCallable({
        continueUrl: `${window.location.origin}/verify-email`,
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

  /**
   * REFRESH FLOW
   * If your backend sets Firestore `isVerified`, then the “real” refresh should be
   * checking membership/employee docs (useMembership/useCurrentEmployee) rather than
   * Firebase's `user.emailVerified`.
   *
   * For now, we do the safest universal action:
   * - force refresh token
   * - if your guards depend on claims, this helps
   * - then try routing to dashboard; guard will bounce back if not verified
   */
  async function onRefreshStatus() {
    setBusy(true);
    setStatus(null);

    try {
      const u = auth.currentUser;
      if (!u) {
        setStatus({
          kind: "error",
          text: "You’re not signed in. Please sign in again.",
        });
        return;
      }

      try {
        await u.getIdToken(true);
      } catch {
        // ignore
      }

      // If you rely on Firebase emailVerified, you can also reload here:
      // await u.reload();

      // Route attempt — if your app guard uses membership/employee isVerified,
      // it will allow/deny correctly.
      nav("/dashboard", { replace: true });
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
                    Confirm happens when you click the email link
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
                    Click the verification link in your email — then we’ll
                    redirect.
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
                      Subject usually includes “Verify” or “Confirm”.
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
                      If you’re logged out, we’ll ask you to sign in to finish.
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#3a3f4b] bg-[#0b0e14]/35 p-4">
                    <div className="text-[11px] uppercase tracking-wide text-white/50">
                      Step 3
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white/85">
                      Continue to Dashboard
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
