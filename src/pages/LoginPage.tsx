// src/pages/LoginPage.tsx
import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import roofing from "../assets/roofing.webp";
import logo from "../assets/logo-white.svg";
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";

// Assumes you export `auth` from ./firebase/firebaseConfig
import { auth, db } from "../firebase/firebaseConfig";
import { signInWithEmailAndPassword } from "firebase/auth";
import { confirmCustomEmailVerificationCallable } from "../firebase/emailVerification";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";

import {
  AnimatePresence,
  motion,
  type Variants,
  useReducedMotion,
} from "framer-motion";

const LS_ACTIVE_ORG_KEY = "rr_activeOrgId";
const PENDING_VERIFY_TOKEN_KEY = "roofzeus_pending_verify_token";
const ease = [0.16, 1, 0.3, 1] as const;

const pageStagger: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(10px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease },
  },
};

const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.7, ease } },
};

const cardIn: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.99, filter: "blur(10px)" },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease },
  },
};

const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect");
  const prefersReducedMotion = useReducedMotion();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function handleEmailLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);

    try {
      const cred = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      const user = cred.user;

      // ✅ If user clicked verify link while logged out,
      // complete the pending verification now.
      const pendingToken = sessionStorage.getItem(PENDING_VERIFY_TOKEN_KEY);

      if (pendingToken) {
        try {
          await confirmCustomEmailVerificationCallable({ token: pendingToken });

          // remove stored token once consumed
          sessionStorage.removeItem(PENDING_VERIFY_TOKEN_KEY);

          // refresh Firebase Auth user so emailVerified updates locally
          await auth.currentUser?.reload();

          try {
            await auth.currentUser?.getIdToken(true);
          } catch {
            // ignore token refresh issues
          }
        } catch (verifyErr) {
          console.error(
            "Failed to confirm pending email verification after login:",
            verifyErr
          );

          setErr(
            "We signed you in, but could not finish email verification. Please open the verification link again or request a new one."
          );
          return;
        }
      }

      // Fetch employee record (ORG-NESTED) to determine access role
      // Resolve org via memberships, then read ORG-NESTED employee doc
      let accessRole: string | undefined;
      let role: string | undefined;
      let orgId: string | undefined;

      try {
        // 1) Find active membership for this user (top-level index)
        const memQ = query(
          collection(db, "memberships"),
          where("userId", "==", user.uid),
          where("status", "==", "active"),
          limit(1)
        );

        const memSnap = await getDocs(memQ);

        if (!memSnap.empty) {
          const mem = memSnap.docs[0].data() as any;
          orgId = mem.orgId;

          // ✅ hard guard: orgId must be a string
          if (typeof orgId !== "string" || !orgId.trim()) {
            console.warn("Membership missing orgId for user:", user.uid, mem);
          } else {
            // 2) Persist active org for rest of app
            localStorage.setItem(LS_ACTIVE_ORG_KEY, orgId);

            // 3) Read org-nested employee doc
            const empRef = doc(
              db,
              "organizations",
              orgId,
              "employees",
              user.uid
            );
            const empSnap = await getDoc(empRef);

            if (empSnap.exists()) {
              const emp = empSnap.data() as any;
              accessRole = emp.accessRole;
              role = emp.role;
            } else {
              console.warn("Employee doc missing at:", empRef.path);
            }
          }
        } else {
          console.warn("No active membership found for user:", user.uid);
        }
      } catch (e) {
        // IMPORTANT: Don't silently swallow this; it decides routing.
        console.error("Failed to resolve membership/employee:", e);
      }

      // ✅ redirect back to invite or to proper dashboard based on role
      if (redirect) {
        navigate(redirect, { replace: true });
        return;
      }

      if (!accessRole && !role) {
        setErr(
          "Account found, but role info could not be loaded. Please refresh or contact support."
        );
        return;
      }

      if (
        accessRole === "admin" ||
        accessRole === "manager" ||
        role === "owner"
      ) {
        navigate("/dashboard", { replace: true });
      } else {
        navigate("/crew", { replace: true });
      }
    } catch (error: any) {
      const msg =
        error?.code === "auth/invalid-credential"
          ? "Invalid email or password."
          : error?.message || "Login failed. Please try again.";
      setErr(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const hoverLift = prefersReducedMotion
    ? {}
    : { y: -2, transition: { duration: 0.25, ease } };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={pageStagger}
      className="min-h-screen w-full relative overflow-hidden bg-[#0b0e14]"
    >
      {/* Background image + overlays */}
      <motion.div
        variants={fade}
        className="absolute inset-0"
        aria-hidden="true"
      >
        <img
          src={roofing}
          alt=""
          className="h-full w-full object-cover opacity-[0.14] blur-[2px] scale-[1.03]"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/55 to-black/75" />

        {/* Ambient glows */}
        <motion.div
          className="absolute -top-28 -left-28 h-80 w-80 rounded-full blur-3xl opacity-35 bg-[#cfae5d]"
          animate={
            prefersReducedMotion
              ? undefined
              : { opacity: [0.26, 0.4, 0.26], scale: [1, 1.05, 1] }
          }
          transition={
            prefersReducedMotion
              ? undefined
              : { duration: 8, ease, repeat: Infinity, repeatType: "mirror" }
          }
        />
        <motion.div
          className="absolute -bottom-40 -right-24 h-[520px] w-[520px] rounded-full blur-3xl opacity-25 bg-[var(--color-logo)]"
          animate={
            prefersReducedMotion
              ? undefined
              : { opacity: [0.18, 0.3, 0.18], scale: [1, 1.06, 1] }
          }
          transition={
            prefersReducedMotion
              ? undefined
              : { duration: 10, ease, repeat: Infinity, repeatType: "mirror" }
          }
        />
        <div className="absolute inset-0 [background-image:radial-gradient(transparent_0,rgba(0,0,0,0.35)_55%,rgba(0,0,0,0.6)_100%)]" />
      </motion.div>

      {/* Content */}
      <div className="relative z-10 min-h-screen w-full flex items-center justify-center px-4 py-10">
        <motion.div variants={fadeUp} className="w-full max-w-[980px]">
          <motion.div
            variants={cardIn}
            className="rounded-2xl border border-[#3a3f4b]/70 bg-[#0b0e14]/35 backdrop-blur-xl shadow-[0_25px_80px_rgba(0,0,0,0.55)] overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* Left (brand) */}
              <div className="relative p-6 sm:p-8 md:p-10">
                <motion.div variants={item} className="flex items-center gap-3">
                  <motion.div
                    whileHover={prefersReducedMotion ? undefined : hoverLift}
                    className="rounded-xl p-3"
                  >
                    <img
                      className="max-w-[250px] w-full select-none"
                      src={logo}
                      alt="ROOFZEUS"
                      draggable={false}
                    />
                  </motion.div>
                </motion.div>

                <motion.div variants={item} className="mt-6">
                  <div className="mt-2 text-white/60 text-sm leading-relaxed max-w-md">
                    Sign in to manage jobs, track profit, schedule crews, and
                    generate pay stubs—everything your roofing operation needs,
                    in one place.
                  </div>

                  <motion.div
                    variants={pageStagger}
                    className="mt-6 grid gap-3 max-w-md"
                  >
                    <motion.div
                      variants={item}
                      whileHover={prefersReducedMotion ? undefined : hoverLift}
                      className="flex items-start gap-3 rounded-xl border border-[#3a3f4b]/60 bg-white/5 px-4 py-3"
                    >
                      <ShieldCheck className="h-5 w-5 text-[#cfae5d] mt-0.5" />
                      <div>
                        <div className="text-sm font-semibold text-white">
                          Role-aware access
                        </div>
                        <div className="text-[12px] text-white/55">
                          Admins and crews land in the right dashboard
                          automatically.
                        </div>
                      </div>
                    </motion.div>

                    <motion.div
                      variants={item}
                      whileHover={prefersReducedMotion ? undefined : hoverLift}
                      className="flex items-start gap-3 rounded-xl border border-[#3a3f4b]/60 bg-white/5 px-4 py-3"
                    >
                      <Lock className="h-5 w-5 text-[#cfae5d] mt-0.5" />
                      <div>
                        <div className="text-sm font-semibold text-white">
                          Secure sign-in
                        </div>
                        <div className="text-[12px] text-white/55">
                          Your data stays protected with Firebase Auth.
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                </motion.div>

                <motion.div
                  variants={item}
                  className="mt-8 text-[11px] text-white/45"
                >
                  © {new Date().getFullYear()} ROOFZEUS • Built for roofing
                  contractors
                </motion.div>
              </div>

              {/* Right (form) */}
              <div className="p-6 sm:p-8 md:p-10 border-t md:border-t-0 md:border-l border-[#3a3f4b]/60">
                <motion.div
                  variants={pageStagger}
                  className="flex items-center justify-between gap-3"
                >
                  <motion.div variants={item}>
                    <div className="text-white text-lg font-semibold">
                      Sign in
                    </div>
                    <div className="mt-1 text-white/55 text-sm">
                      Use your company account credentials.
                    </div>
                  </motion.div>

                  <motion.div variants={item}>
                    <div className="hidden sm:flex items-center gap-2 rounded-full border border-[#3a3f4b]/70 bg-white/5 px-3 py-1 text-[12px] text-white/65">
                      <motion.span
                        className="h-2 w-2 rounded-full bg-emerald-400/80"
                        animate={
                          prefersReducedMotion
                            ? undefined
                            : { scale: [1, 1.25, 1], opacity: [0.65, 1, 0.65] }
                        }
                        transition={
                          prefersReducedMotion
                            ? undefined
                            : { duration: 2.2, repeat: Infinity, ease }
                        }
                      />
                      System online
                    </div>
                  </motion.div>
                </motion.div>

                {/* Error */}
                <AnimatePresence mode="popLayout">
                  {err && (
                    <motion.div
                      key="login-error"
                      initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        filter: "blur(0px)",
                        transition: { duration: 0.35, ease },
                      }}
                      exit={{
                        opacity: 0,
                        y: 6,
                        filter: "blur(8px)",
                        transition: { duration: 0.22, ease },
                      }}
                      className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                    >
                      {err}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.form
                  onSubmit={handleEmailLogin}
                  variants={pageStagger}
                  className="mt-6 space-y-4"
                >
                  {/* Email */}
                  <motion.div variants={item} className="space-y-1.5">
                    <label
                      htmlFor="email"
                      className="text-xs font-semibold uppercase tracking-wide text-white/65"
                    >
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/35" />
                      <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        className={[
                          "w-full rounded-xl border px-10 py-3 outline-none transition",
                          "bg-white/5 border-[#3a3f4b]/70 text-white placeholder:text-white/30",
                          "focus:border-[#cfae5d]/70 focus:ring-2 focus:ring-[#cfae5d]/15",
                        ].join(" ")}
                      />
                    </div>
                  </motion.div>

                  {/* Password */}
                  <motion.div variants={item} className="space-y-1.5">
                    <label
                      htmlFor="password"
                      className="text-xs font-semibold uppercase tracking-wide text-white/65"
                    >
                      Password
                    </label>

                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/35" />
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className={[
                          "w-full rounded-xl border px-10 py-3 pr-12 outline-none transition",
                          "bg-white/5 border-[#3a3f4b]/70 text-white placeholder:text-white/30",
                          "focus:border-[#cfae5d]/70 focus:ring-2 focus:ring-[#cfae5d]/15",
                        ].join(" ")}
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-white/45 hover:text-white/80 transition"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </motion.div>

                  {/* Submit */}
                  <motion.div variants={item}>
                    <motion.button
                      type="submit"
                      disabled={submitting}
                      whileHover={
                        prefersReducedMotion || submitting
                          ? undefined
                          : { y: -1, filter: "brightness(1.08)" }
                      }
                      whileTap={
                        prefersReducedMotion || submitting
                          ? undefined
                          : { y: 0, scale: 0.99, filter: "brightness(0.98)" }
                      }
                      className={[
                        "w-full mt-2 rounded-xl cursor-pointer px-4 py-3 text-sm font-semibold transition",
                        "bg-[#cfae5d] text-black hover:brightness-110 active:brightness-95",
                        "disabled:opacity-70 disabled:cursor-not-allowed",
                        "shadow-[0_10px_25px_rgba(207,174,93,0.18)]",
                      ].join(" ")}
                    >
                      {submitting ? "Signing in…" : "Sign in"}
                    </motion.button>
                  </motion.div>

                  <motion.div
                    variants={item}
                    className="flex items-center justify-between pt-2"
                  >
                    <div className="text-[12px] text-white/45">
                      Having trouble? Contact your admin.
                    </div>

                    <div className="text-[12px] text-white/45">
                      <span className="opacity-70">Tip:</span> try copying the
                      invite link again if you were invited.
                    </div>
                  </motion.div>
                </motion.form>

                <motion.div
                  variants={item}
                  className="mt-6 rounded-xl border border-[#3a3f4b]/60 bg-white/5 px-4 py-3"
                >
                  <div className="text-[12px] text-white/70 font-semibold">
                    Security note
                  </div>
                  <div className="mt-1 text-[12px] text-white/50 leading-relaxed">
                    Always sign in on a trusted device. If your role changes,
                    you’ll be routed to the correct dashboard automatically.
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Bottom micro border shine */}
            <motion.div
              variants={fade}
              className="h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent"
            />
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default LoginPage;
