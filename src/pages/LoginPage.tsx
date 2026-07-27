import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
} from "lucide-react";
import { signInWithEmailAndPassword } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import logo from "../assets/rz-modern-white.svg";
import { auth, db } from "../firebase/firebaseConfig";
import { confirmCustomEmailVerificationCallable } from "../firebase/emailVerification";

const LS_ACTIVE_ORG_KEY = "rr_activeOrgId";
const PENDING_VERIFY_TOKEN_KEY = "roofzeus_pending_verify_token";

function marketingOrigin() {
  const host = window.location.hostname.toLowerCase();
  if (host === "app.localhost") return "http://localhost:5173";
  if (host.endsWith(".vercel.app")) return "https://roofzeus.vercel.app";
  return "https://www.roofzeus.com";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function handleEmailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      const user = credential.user;
      const pendingToken = sessionStorage.getItem(PENDING_VERIFY_TOKEN_KEY);

      if (pendingToken) {
        try {
          await confirmCustomEmailVerificationCallable({ token: pendingToken });
          sessionStorage.removeItem(PENDING_VERIFY_TOKEN_KEY);
          await auth.currentUser?.reload();
          try {
            await auth.currentUser?.getIdToken(true);
          } catch {
            // A token refresh failure should not erase a successful sign-in.
          }
        } catch (verificationError) {
          console.error(
            "Failed to confirm pending email verification after login:",
            verificationError
          );
          setError(
            "We signed you in, but could not finish email verification. Open the verification link again or request a new one."
          );
          return;
        }
      }

      let accessRole: string | undefined;
      let role: string | undefined;

      try {
        const membershipQuery = query(
          collection(db, "memberships"),
          where("userId", "==", user.uid),
          where("status", "==", "active"),
          limit(1)
        );
        const membershipSnapshot = await getDocs(membershipQuery);

        if (!membershipSnapshot.empty) {
          const membership = membershipSnapshot.docs[0].data() as {
            orgId?: unknown;
          };
          const orgId =
            typeof membership.orgId === "string"
              ? membership.orgId.trim()
              : "";

          if (orgId) {
            localStorage.setItem(LS_ACTIVE_ORG_KEY, orgId);
            const employeeRef = doc(
              db,
              "organizations",
              orgId,
              "employees",
              user.uid
            );
            const employeeSnapshot = await getDoc(employeeRef);

            if (employeeSnapshot.exists()) {
              const employee = employeeSnapshot.data() as {
                accessRole?: string;
                role?: string;
              };
              accessRole = employee.accessRole;
              role = employee.role;
            } else {
              console.warn("Employee record is missing at:", employeeRef.path);
            }
          } else {
            console.warn("Membership is missing an organization ID:", user.uid);
          }
        } else {
          console.warn("No active membership found for user:", user.uid);
        }
      } catch (membershipError) {
        console.error(
          "Failed to resolve membership and employee access:",
          membershipError
        );
      }

      if (redirect) {
        navigate(redirect, { replace: true });
        return;
      }

      if (!accessRole && !role) {
        setError(
          "Your account was found, but access details could not be loaded. Refresh the page or contact support."
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
    } catch (caughtError: unknown) {
      const authError = caughtError as { code?: string; message?: string };
      setError(
        authError.code === "auth/invalid-credential"
          ? "That email and password combination does not match an account."
          : authError.message || "Sign in failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="rz-auth-page">
      <div className="rz-auth-shell">
        <section className="rz-auth-story">
          <a href={marketingOrigin()} aria-label="Visit the Roof Zeus website">
            <img className="rz-auth-story__logo" src={logo} alt="Roof Zeus" />
          </a>
          <div>
            <h1>Your work is right where you left it.</h1>
            <p>
              Open your jobs, finances, payouts, and documents.
            </p>
            <div className="rz-auth-story__proof">
              <span>
                <CheckCircle2 aria-hidden="true" />
                Company workspace
              </span>
              <span>
                <CheckCircle2 aria-hidden="true" />
                Focused team access
              </span>
            </div>
          </div>
        </section>

        <section className="rz-auth-form-panel">
          <div className="rz-auth-form-panel__head">
            <div>
              <h2>Welcome back</h2>
              <p>Sign in to your Roof Zeus workspace.</p>
            </div>
          </div>

          {error ? (
            <div className="rz-auth-error" role="alert">
              {error}
            </div>
          ) : null}

          <form className="rz-auth-form" onSubmit={handleEmailLogin}>
            <label className="rz-auth-field" htmlFor="email">
              <span className="rz-auth-field__label">Work email</span>
              <span className="rz-auth-input-wrap">
                <Mail aria-hidden="true" />
                <input
                  className="rz-auth-input"
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                />
              </span>
            </label>

            <label className="rz-auth-field" htmlFor="password">
              <span className="rz-auth-field__label">Password</span>
              <span className="rz-auth-input-wrap">
                <Lock aria-hidden="true" />
                <input
                  className="rz-auth-input"
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                />
                <button
                  className="rz-password-toggle"
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff aria-hidden="true" />
                  ) : (
                    <Eye aria-hidden="true" />
                  )}
                </button>
              </span>
            </label>

            <button
              className="rz-auth-submit"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Signing in…" : "Sign in"}
              {!submitting ? <ArrowRight aria-hidden="true" /> : null}
            </button>
          </form>

          <p className="rz-auth-switch">
            New to Roof Zeus? <Link to="/signup">Start your free trial</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
