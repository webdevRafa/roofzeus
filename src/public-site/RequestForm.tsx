import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { CONSENT_VERSION } from "./content";
import { BotCheck, Busy } from "./Widgets";
import { intakeConfigured, submitIntake } from "./integrations";
export function PartnerForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const [token, setToken] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const id = useRef("");
  useEffect(() => {
    id.current = crypto.randomUUID();
  }, []);
  if (reference)
    return (
      <div className="rz-note" role="status">
        <CheckCircle2 />
        <h3>Your interest is registered.</h3>
        <p>
          Reference: {reference}. RoofZeus will review your information. This is
          not approval into the network or a commitment to purchase leads.
        </p>
      </div>
    );
  return (
    <form
      className="rz-partner-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const data = Object.fromEntries(new FormData(e.currentTarget));
        setBusy(true);
        setError("");
        try {
          const response = await submitIntake({
            ...data,
            consent: true,
            kind: "contractor",
            requestId: id.current,
            turnstileToken: token,
            consentVersion: CONSENT_VERSION,
            sourcePath: "/for-contractors",
          });
          setReference(response.reference);
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : "Unable to register. Please try again.",
          );
          setToken("");
          setResetKey((k) => k + 1);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="rz-fields">
        <label className="rz-field">
          Business name
          <input
            name="businessName"
            required
            maxLength={150}
            autoComplete="organization"
          />
        </label>
        <label className="rz-field">
          Your name
          <input
            name="name"
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
          />
        </label>
      </div>
      <div className="rz-fields">
        <label className="rz-field">
          Business email
          <input
            type="email"
            name="email"
            required
            maxLength={180}
            autoComplete="email"
          />
        </label>
        <label className="rz-field">
          Phone
          <input
            type="tel"
            name="phone"
            required
            pattern="[0-9+() .-]{10,25}"
            maxLength={25}
            autoComplete="tel"
          />
        </label>
      </div>
      <label className="rz-field">
        Service ZIP codes
        <input
          name="territoryZips"
          required
          maxLength={350}
          placeholder="78201, 78209, 78230"
          pattern="[0-9, ]+"
        />
        <span className="rz-field-help">
          Enter up to 30 five-digit ZIP codes, separated by commas.
        </span>
      </label>
      <label className="rz-field">
        Services and business website
        <textarea
          name="notes"
          rows={3}
          maxLength={2000}
          placeholder="Tell us about your work and where we can learn more."
        />
      </label>
      <label className="rz-honeypot" aria-hidden="true">
        Leave empty
        <input tabIndex={-1} name="website" autoComplete="off" />
      </label>
      <label className="rz-checkbox">
        <input name="consent" required type="checkbox" />I agree that RoofZeus
        may contact me about joining its contractor network. Registration does
        not guarantee leads or approve my business for referrals.
      </label>
      <p className="rz-field-help">
        Read our <Link to="/privacy">Privacy Policy</Link> and{" "}
        <Link to="/terms">Terms</Link>.
      </p>
      <BotCheck onToken={setToken} resetKey={resetKey} />
      {!intakeConfigured && (
        <p className="rz-note">
          Network registration is opening soon. Submissions are not available
          yet.
        </p>
      )}
      {error && (
        <p role="alert" className="rz-error">
          {error}
        </p>
      )}
      <button
        className="rz-button"
        disabled={busy || !token || !intakeConfigured}
      >
        {busy ? (
          <Busy />
        ) : (
          <>
            Register interest <ArrowRight size={18} />
          </>
        )}
      </button>
    </form>
  );
}
