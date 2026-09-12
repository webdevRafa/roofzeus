import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { CONTACT_CONSENT, CONSENT_VERSION, services } from "./content";
import { AddressSearch, BotCheck, Busy } from "./Widgets";
import {
  intakeConfigured,
  lookupZip,
  submitIntake,
  track,
} from "./integrations";

const states =
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(
    " ",
  );
const empty = {
  service: "",
  urgency: "Within a month",
  propertyType: "Single-family home",
  roofMaterial: "Not sure",
  notes: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  name: "",
  email: "",
  phone: "",
  contactMethod: "email",
  authorized: false,
  consent: false,
  website: "",
};
export default function EstimateFunnel({ onBack }: { onBack: () => void }) {
  const [params] = useSearchParams();
  const [form, setForm] = useState(empty);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const [reset, setReset] = useState(0);
  const [reference, setReference] = useState("");
  const [zipStatus, setZipStatus] = useState("");
  const id = useRef("");
  const heading = useRef<HTMLHeadingElement>(null);
  const set = <K extends keyof typeof empty>(
    key: K,
    value: (typeof empty)[K],
  ) => setForm((f) => ({ ...f, [key]: value }));
  useEffect(() => {
    id.current = crypto.randomUUID();
    const zip = params.get("zip") || "";
    const service = params.get("service") || "";
    setForm((f) => ({
      ...f,
      zip: /^\d{5}$/.test(zip) ? zip : "",
      service: services.some((s) => s.slug === service) ? service : "",
    }));
    track("estimate_started");
  }, [params]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    if (step > 0)
      document
        .getElementById("estimate-funnel")
        ?.scrollIntoView({ block: "start" });
  }, [step, reference]);
  useEffect(() => {
    if (!/^\d{5}$/.test(form.zip)) return;
    const controller = new AbortController();
    const timeout = setTimeout(
      () =>
        lookupZip(form.zip, controller.signal)
          .then((place) => {
            if (place) {
              setForm((f) => ({
                ...f,
                city: f.city || place.city,
                state: f.state || place.state,
              }));
              setZipStatus(
                `${place.city}, ${place.state}. Please confirm below.`,
              );
            } else setZipStatus("Please enter your city and state below.");
          })
          .catch(() => {
            if (!controller.signal.aborted)
              setZipStatus("You can enter your city and state manually.");
          }),
      250,
    );
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [form.zip]);
  async function send() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await submitIntake({
        ...form,
        kind: "homeowner",
        requestId: id.current,
        consentVersion: CONSENT_VERSION,
        turnstileToken: token,
        sourcePath: "/",
      });
      setReference(result.reference);
      setForm(empty);
      track("estimate_completed");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "We couldn’t save your details. Please try again.",
      );
      setToken("");
      setReset((r) => r + 1);
    } finally {
      setBusy(false);
    }
  }
  if (reference)
    return (
      <div className="rz-estimate-success">
        <CheckCircle2 size={44} />
        <h2 ref={heading} tabIndex={-1}>
          You’re all set.
        </h2>
        <p>
          RoofZeus will follow up about roofing estimate options using your
          preferred contact method.
        </p>
        <p className="rz-field-help">
          Your reference: <strong>{reference}</strong>
        </p>
        <div className="rz-note">
          No price or appointment is confirmed yet. We’ll ask before introducing
          a named contractor. Availability varies by location.
        </div>
        <button className="rz-button" onClick={onBack}>
          Back to home
        </button>
      </div>
    );
  return (
    <div className="rz-estimate-steps">
      <div className="rz-estimate-step-top">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setError("");
            if (step === 0) onBack();
            else setStep((s) => s - 1);
          }}
        >
          <ArrowLeft size={16} /> Back
        </button>
        <span>{step + 1} of 3</span>
      </div>
      <div
        className="rz-estimate-progress"
        aria-label={`Step ${step + 1} of 3`}
      >
        {[0, 1, 2].map((i) => (
          <span key={i} className={i <= step ? "complete" : ""} />
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step === 2) void send();
          else {
            setError("");
            setStep((s) => s + 1);
            track("estimate_step_completed", { step: step + 1 });
          }
        }}
      >
        <h2 ref={heading} tabIndex={-1}>
          {
            [
              "What does your roof need?",
              "Which home is it for?",
              "Where can we reach you?",
            ][step]
          }
        </h2>
        {step === 0 && (
          <>
            <p>Choose the closest fit. It’s okay if you’re not sure.</p>
            <fieldset className="rz-choice-grid">
              <legend className="rz-sr-only">Roofing service</legend>
              {[
                ...services.map((s) => ({ value: s.slug, name: s.name })),
                { value: "not-sure", name: "Not sure yet" },
                { value: "commercial", name: "Commercial roofing" },
              ].map((s) => (
                <label
                  key={s.value}
                  className={form.service === s.value ? "selected" : ""}
                >
                  <input
                    required
                    name="service"
                    type="radio"
                    checked={form.service === s.value}
                    onChange={() => set("service", s.value)}
                  />
                  {s.name}
                </label>
              ))}
            </fieldset>
            <label className="rz-field">
              When do you need help?
              <select
                value={form.urgency}
                onChange={(e) => set("urgency", e.target.value)}
              >
                {[
                  "Active leak / urgent",
                  "As soon as possible",
                  "Within a month",
                  "Just planning ahead",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="rz-field">
              Type of home or building
              <select
                value={form.propertyType}
                onChange={(e) => set("propertyType", e.target.value)}
              >
                {[
                  "Single-family home",
                  "Townhome / duplex",
                  "Multi-family",
                  "Commercial building",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            {form.urgency === "Active leak / urgent" && (
              <p className="rz-note">
                This is not an emergency dispatch service. Don’t wait for us if
                there is an immediate danger.
              </p>
            )}
          </>
        )}
        {step === 1 && (
          <>
            <p>Your address helps us check local availability.</p>
            <AddressSearch
              onSelect={(address) => setForm((f) => ({ ...f, ...address }))}
            />
            <label className="rz-field">
              Street address
              <input
                autoComplete="street-address"
                required
                minLength={5}
                maxLength={180}
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </label>
            <div className="rz-fields">
              <label className="rz-field">
                ZIP code
                <input
                  required
                  autoComplete="postal-code"
                  inputMode="numeric"
                  pattern="[0-9]{5}"
                  maxLength={5}
                  value={form.zip}
                  onChange={(e) => {
                    set("zip", e.target.value.replace(/\D/g, ""));
                    set("city", "");
                    set("state", "");
                    setZipStatus("");
                  }}
                />
              </label>
              <label className="rz-field">
                State
                <select
                  required
                  aria-label="State"
                  autoComplete="address-level1"
                  value={form.state}
                  onChange={(e) => set("state", e.target.value)}
                >
                  <option value="">Select</option>
                  {states.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="rz-field-help" role="status">
              {zipStatus}
            </p>
            <label className="rz-field">
              City
              <input
                required
                autoComplete="address-level2"
                minLength={2}
                maxLength={80}
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </label>
            <label className="rz-checkbox">
              <input
                required
                type="checkbox"
                checked={form.authorized}
                onChange={(e) => set("authorized", e.target.checked)}
              />
              I own this property or am authorized to arrange work for it.
            </label>
          </>
        )}
        {step === 2 && (
          <>
            <p>We’ll follow up about your roofing estimate options.</p>
            <div className="rz-estimate-summary">
              <span>
                {services.find((s) => s.slug === form.service)?.name ||
                  "Roofing help"}{" "}
                · {form.zip}
              </span>
              <button type="button" onClick={() => setStep(0)}>
                Edit
              </button>
            </div>
            <label className="rz-field">
              Full name
              <input
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </label>
            <label className="rz-field">
              Email address
              <input
                required
                type="email"
                maxLength={180}
                autoComplete="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </label>
            <label className="rz-field">
              Phone number{" "}
              <span className="rz-optional">
                {form.contactMethod === "phone"
                  ? "Required for a call"
                  : "Optional"}
              </span>
              <input
                type="tel"
                autoComplete="tel"
                required={form.contactMethod === "phone"}
                pattern="[0-9+() .-]{10,25}"
                maxLength={25}
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </label>
            <label className="rz-field">
              Contact me by
              <select
                value={form.contactMethod}
                onChange={(e) => set("contactMethod", e.target.value)}
              >
                <option value="email">Email</option>
                <option value="phone">Phone call</option>
              </select>
            </label>
            <label className="rz-checkbox">
              <input
                required
                type="checkbox"
                checked={form.consent}
                onChange={(e) => set("consent", e.target.checked)}
              />
              {CONTACT_CONSENT}
            </label>
            <p className="rz-field-help">
              By continuing, you accept our{" "}
              <a href="/terms" target="_blank" rel="noopener">
                Terms
              </a>{" "}
              and{" "}
              <a href="/privacy" target="_blank" rel="noopener">
                Privacy Policy
              </a>
              . Estimates depend on contractor availability and assessment.
            </p>
            <BotCheck onToken={setToken} resetKey={reset} />
            {!intakeConfigured && (
              <p className="rz-note" role="status">
                Estimate matching is opening soon. You can explore the steps,
                but we can’t accept your details yet.
              </p>
            )}
          </>
        )}
        <label className="rz-honeypot" aria-hidden="true">
          Leave empty
          <input
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(e) => set("website", e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="rz-error">
            {error}
          </p>
        )}
        <button
          className="rz-button rz-estimate-next"
          disabled={busy || (step === 2 && (!intakeConfigured || !token))}
        >
          {busy ? (
            <>
              <Busy /> Saving…
            </>
          ) : (
            <>
              {step === 2 ? "Get my estimate" : "Continue"}
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
