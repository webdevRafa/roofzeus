// src/pages/LoginPage.tsx
import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import roofing from "../assets/roofing.webp";
import logo from "../assets/roofzeus-white.png";
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";

// Assumes you export `auth` from ./firebase/firebaseConfig
import { auth, db } from "../firebase/firebaseConfig";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs, limit } from "firebase/firestore";

const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect");

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

      // Fetch employee record to determine access role
      let accessRole: string | undefined;
      try {
        const q = query(
          collection(db, "employees"),
          where("userId", "==", user.uid),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data: any = snap.docs[0].data();
          accessRole = data.accessRole;
        }
      } catch (e) {
        // ignore errors and fall back to default
        console.error("Failed to fetch employee record", e);
      }

      // ✅ redirect back to invite or to proper dashboard based on role
      if (redirect) {
        navigate(redirect, { replace: true });
      } else if (accessRole === "admin" || accessRole === "manager") {
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

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-[#0b0e14]">
      {/* Background image + overlays */}
      <div className="absolute inset-0">
        <img
          src={roofing}
          alt=""
          className="h-full w-full object-cover opacity-[0.14] blur-[2px] scale-[1.03]"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/55 to-black/75" />
        <div className="absolute -top-28 -left-28 h-80 w-80 rounded-full blur-3xl opacity-35 bg-[#cfae5d]" />
        <div className="absolute -bottom-40 -right-24 h-[520px] w-[520px] rounded-full blur-3xl opacity-25 bg-[var(--color-logo)]" />
        <div className="absolute inset-0 [background-image:radial-gradient(transparent_0,rgba(0,0,0,0.35)_55%,rgba(0,0,0,0.6)_100%)]" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen w-full flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[980px]">
          <div className="rounded-2xl border border-[#3a3f4b]/70 bg-[#0b0e14]/35 backdrop-blur-xl shadow-[0_25px_80px_rgba(0,0,0,0.55)] overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* Left (brand) */}
              <div className="relative p-6 sm:p-8 md:p-10 ">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl  p-3 shadow-sm">
                    <img
                      className="max-w-[250px] w-auto select-none"
                      src={logo}
                      alt="ROOFZEUS"
                      draggable={false}
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <div className="text-white text-2xl sm:text-3xl font-semibold tracking-tight">
                    Welcome back
                  </div>
                  <div className="mt-2 text-white/60 text-sm leading-relaxed max-w-md">
                    Sign in to manage jobs, track profit, schedule crews, and
                    generate pay stubs—everything your roofing operation needs,
                    in one place.
                  </div>

                  <div className="mt-6 grid gap-3 max-w-md">
                    <div className="flex items-start gap-3 rounded-xl border border-[#3a3f4b]/60 bg-white/5 px-4 py-3">
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
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-[#3a3f4b]/60 bg-white/5 px-4 py-3">
                      <Lock className="h-5 w-5 text-[#cfae5d] mt-0.5" />
                      <div>
                        <div className="text-sm font-semibold text-white">
                          Secure sign-in
                        </div>
                        <div className="text-[12px] text-white/55">
                          Your data stays protected with Firebase Auth.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 text-[11px] text-white/45">
                  © {new Date().getFullYear()} ROOFZEUS • Built for roofing
                  contractors
                </div>
              </div>

              {/* Right (form) */}
              <div className="p-6 sm:p-8 md:p-10">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-white text-lg font-semibold">
                      Sign in
                    </div>
                    <div className="mt-1 text-white/55 text-sm">
                      Use your company account credentials.
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-2 rounded-full border border-[#3a3f4b]/70 bg-white/5 px-3 py-1 text-[12px] text-white/65">
                    <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
                    System online
                  </div>
                </div>

                {/* Error */}
                {err && (
                  <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {err}
                  </div>
                )}

                <form onSubmit={handleEmailLogin} className="mt-6 space-y-4">
                  {/* Email */}
                  <div className="space-y-1.5">
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
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
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
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className={[
                      "w-full mt-2 rounded-xl px-4 py-3 text-sm font-semibold transition",
                      "bg-[#cfae5d] text-black hover:brightness-110 active:brightness-95",
                      "disabled:opacity-70 disabled:cursor-not-allowed",
                      "shadow-[0_10px_25px_rgba(207,174,93,0.18)]",
                    ].join(" ")}
                  >
                    {submitting ? "Signing in…" : "Sign in"}
                  </button>

                  <div className="flex items-center justify-between pt-2">
                    <div className="text-[12px] text-white/45">
                      Having trouble? Contact your admin.
                    </div>

                    {/* (Optional) You can wire this later if you add reset flow */}
                    <div className="text-[12px] text-white/45">
                      <span className="opacity-70">Tip:</span> try copying the
                      invite link again if you were invited.
                    </div>
                  </div>
                </form>

                <div className="mt-6 rounded-xl border border-[#3a3f4b]/60 bg-white/5 px-4 py-3">
                  <div className="text-[12px] text-white/70 font-semibold">
                    Security note
                  </div>
                  <div className="mt-1 text-[12px] text-white/50 leading-relaxed">
                    Always sign in on a trusted device. If your role changes,
                    you’ll be routed to the correct dashboard automatically.
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom micro border shine */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
