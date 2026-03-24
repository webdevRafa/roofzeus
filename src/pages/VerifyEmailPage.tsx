// src/pages/VerifyEmailPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import { getAuth } from "firebase/auth";
import {
  sendCustomEmailVerificationCallable,
  confirmCustomEmailVerificationCallable,
} from "../firebase/emailVerification";
import { Mail, RefreshCcw } from "lucide-react";
import roof from "../assets/roof-lightning.svg";

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

    console.log("[verify] urlToken:", urlToken);
    console.log("[verify] storedToken:", storedToken);
    console.log("[verify] auth.currentUser:", auth.currentUser?.uid || null);

    // Nothing to confirm
    if (!token) return;

    // If user is not logged in, store token and send to login
    if (!auth.currentUser) {
      console.log(
        "[verify] no auth user, storing token and redirecting to login"
      );
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
        console.log("[verify] calling confirmCustomEmailVerificationCallable");
        await confirmCustomEmailVerificationCallable({ token });
        console.log("[verify] confirm callable succeeded");
        // token used successfully; clear it
        sessionStorage.removeItem(PENDING_VERIFY_TOKEN_KEY);

        if (!mountedRef.current) return;

        setStatus({ kind: "success", text: "Email verified. Redirecting…" });

        try {
          await auth.currentUser?.reload();
        } catch {
          // ignore
        }

        try {
          await auth.currentUser?.getIdToken(true);
        } catch {
          // ignore
        }

        if (auth.currentUser?.emailVerified) {
          nav("/dashboard", { replace: true });
        } else {
          setStatus({
            kind: "info",
            text: "Email was confirmed, but your session is still refreshing. Please tap Refresh status.",
          });
        }
      } catch (e) {
        console.error("[verify] confirm callable failed:", e);
        const msg = e instanceof Error ? e.message : "Failed to confirm email.";
        if (!mountedRef.current) return;
        setStatus({ kind: "error", text: msg });
      } finally {
        if (mountedRef.current) setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.search, auth, nav]);
  useEffect(() => {
    let timer: number | null = null;

    function startPolling() {
      timer = window.setInterval(async () => {
        const u = auth.currentUser;
        if (!u) return;

        try {
          await u.reload();
        } catch {
          return;
        }

        if (auth.currentUser?.emailVerified) {
          if (timer) window.clearInterval(timer);
          nav("/dashboard", { replace: true });
        }
      }, 3000);
    }

    startPolling();

    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [auth, nav]);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;
    const userDocRef = doc(db, "users", u.uid);
    const unsubscribe = onSnapshot(userDocRef, (snap) => {
      const data = snap.data() as any;
      if (data?.emailVerified) {
        nav("/dashboard", { replace: true });
      }
    });
    return () => unsubscribe();
  }, [auth, nav]);

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
        await u.reload();
      } catch {
        // ignore
      }

      try {
        await u.getIdToken(true);
      } catch {
        // ignore
      }

      const refreshed = auth.currentUser;

      if (refreshed?.emailVerified) {
        nav("/dashboard", { replace: true });
        return;
      }

      setStatus({
        kind: "info",
        text: "Your email is not verified yet. Click the link in your inbox, then try again.",
      });
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0c1527] text-[#f5f6f8] overflow-x-hidden">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative max-w-7xl mx-auto  px-6 pt-24 pb-16"
      >
        <div className="grid lg:grid-cols-12 gap-8 items-center  ">
          {/* Left copy */}
          <motion.div variants={fadeUp} className="lg:col-span-6">
            <img className="w-[300px]" src={roof} alt="" />
            <h1 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight text-white leading-[1.05]">
              Verify your email to unlock the dashboard.
            </h1>
            <p className="text-white text-xs">{status?.kind}</p>
            <p className="mt-4 text-white/75 max-w-xl leading-relaxed">
              We sent a verification link to{" "}
              <span className="text-white/90 font-semibold">
                {email ?? "your email"}
              </span>
              . Once you click it, you will be prompted to sign in with your
              credentials and then you will be routed to the dashboard.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <motion.button
                type="button"
                whileHover={{ y: -1, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                disabled={busy}
                onClick={onRefreshStatus}
                className="inline-flex items-center justify-center gap-2  px-5 py-2.5 text-sm font-semibold text-white/70 hover:text-white  transition disabled:opacity-60"
              >
                <RefreshCcw className="h-4 w-4" />
                I've Verified My Email
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ y: -1, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                disabled={busy}
                onClick={onResend}
                className="inline-flex items-center justify-center gap-2 cursor-pointer  bg-[#0a90f0]/30 hover:bg-[#0a90f0]/40 transition! duration-300 ease-in-out px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90  disabled:opacity-60"
              >
                <Mail className="h-4 w-4" />
                Resend email
              </motion.button>
            </div>

            <div className="mt-10 text-[12px] text-white/55">
              Tip: check spam/junk. If you clicked the verification link on your
              phone, keep this tab open — it will redirect automatically after
              you login.
            </div>
          </motion.div>

          {/* Right card */}
          <motion.div
            variants={cardIn}
            initial="hidden"
            animate="show"
            className="lg:col-span-6"
          >
            <div className="relative overflow-hidden rounded-2xl ">
              <div className="relative">
                <div className="mt-5 grid gap-3">
                  <div className=" p-4">
                    <div className="text-sm md:text-lg uppercase tracking-wide text-white">
                      Step 1
                    </div>
                    <div className="mt-1 text-sm md:text-lg font-semibold text-white/85">
                      Open the verification email
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="text-sm md:text-lg uppercase tracking-wide text-white">
                      Step 2
                    </div>
                    <div className="mt-1 text-sm md:text-lg font-semibold text-white/85">
                      Click the link
                    </div>
                  </div>

                  <div className=" p-4">
                    <div className="text-sm md:text-lg uppercase tracking-wide text-white">
                      Step 3
                    </div>
                    <div className="mt-1 text-sm md:text-lg font-semibold text-white/85">
                      Sign in
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </main>
  );
}
