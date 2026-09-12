import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  LockKeyhole,
  MapPin,
  ShieldCheck,
} from "lucide-react";
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
const initial = {
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
export default function RequestForm() {
  const [params] = useSearchParams();
  const [form, setForm] = useState(initial);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const [reference, setReference] = useState("");
  const [zipStatus, setZipStatus] = useState("");
  const id = useRef("");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const set = <K extends keyof typeof initial>(
    key: K,
    value: (typeof initial)[K],
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
    track("request_started");
  }, [params]);
  useEffect(() => {
    if (step > 0) titleRef.current?.focus();
  }, [step]);
  useEffect(() => {
    if (reference) {
      titleRef.current?.focus();
      window.scrollTo(0, 0);
    }
  }, [reference]);
  useEffect(() => {
    if (!/^\d{5}$/.test(form.zip)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      lookupZip(form.zip, controller.signal)
        .then((place) => {
          if (!place) {
            setZipStatus(
              "We could not look up this ZIP. Please confirm your city and state below.",
            );
            return;
          }
          setForm((f) => ({
            ...f,
            city: f.city || place.city,
            state: f.state || place.state,
          }));
          setZipStatus(
            `${place.city}, ${place.state}. Please confirm the property city and state below.`,
          );
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setZipStatus(
              "ZIP lookup is unavailable. You can enter your city and state manually.",
            );
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form.zip]);
  const title = [
    "What does your roof need?",
    "Where is the property?",
    "How can we reach you?",
    "One last look.",
  ][step];
  const next = () => {
    setError("");
    setStep((s) => s + 1);
    track("request_step_completed", { step: step + 1 });
  };
  async function send() {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const result = await submitIntake({
        ...form,
        kind: "homeowner",
        requestId: id.current,
        consentVersion: CONSENT_VERSION,
        turnstileToken: token,
        sourcePath: "/find-a-roofer",
      });
      setReference(result.reference);
      track("request_submitted", { service: form.service });
      setForm(initial);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Your request could not be sent. Please try again.",
      );
      setToken("");
      setResetKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }
  if (reference)
    return (
      <section className="rz-confirmation rz-container">
        <CheckCircle2 size={54} />
        <p className="rz-eyebrow">REQUEST RECEIVED</p>
        <h1 ref={titleRef} tabIndex={-1}>
          You’ve taken the first step.
        </h1>
        <p>
          Your reference is <strong>{reference}</strong>. RoofZeus will review
          your project and follow up using your preferred contact method.
          Availability is not guaranteed, and no contractor has been assigned
          yet.
        </p>
        <div className="rz-note">
          We’ll ask before sharing your details with a named contractor. There
          is no obligation to hire.
        </div>
        <Link className="rz-button" to="/guides/choosing-a-roofer">
          Prepare for the conversation <ArrowRight size={18} />
        </Link>
      </section>
    );
  return (
    <div className="rz-container rz-request-layout">
      <aside className="rz-request-aside">
        <Link to="/" className="rz-text-link">
          <ArrowLeft size={16} /> Back to home
        </Link>
        <p className="rz-eyebrow">YOUR ROOF. YOUR NEXT STEP.</p>
        <h1>
          Let’s get your
          <br />
          <em>project started.</em>
        </h1>
        <p>
          A few details now make the next conversation easier. It’s free to
          submit, and there’s no obligation to hire.
        </p>
        <div className="rz-aside-points">
          <span>
            <ShieldCheck /> You decide who to hire
          </span>
          <span>
            <LockKeyhole /> Your details stay private
          </span>
          <span>
            <MapPin /> Availability checked locally
          </span>
        </div>
        <div className="rz-note">
          <strong>A network in the making.</strong>
          <p>
            We’re starting in San Antonio and welcome requests across the U.S.
            We review every request before checking for a possible contractor
            introduction.
          </p>
        </div>
      </aside>
      <div className="rz-form-card">
        <ol className="rz-progress" aria-label="Request progress">
          {["Project", "Location", "Contact", "Review"].map((label, i) => (
            <li
              key={label}
              className={i <= step ? "active" : ""}
              aria-current={i === step ? "step" : undefined}
            >
              <span>{i < step ? <Check size={15} /> : i + 1}</span>
              {label}
            </li>
          ))}
        </ol>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (step === 3) void send();
            else next();
          }}
        >
          <p className="rz-eyebrow">STEP {step + 1} OF 4</p>
          <h2 ref={titleRef} tabIndex={-1}>
            {title}
          </h2>
          {step === 0 && (
            <>
              <p>
                Choose the closest fit. “Not sure” is a perfectly good answer.
              </p>
              <fieldset className="rz-choice-grid">
                <legend className="rz-sr-only">Roofing service</legend>
                {[
                  ...services.map((s) => ({ value: s.slug, name: s.name })),
                  { value: "not-sure", name: "Not sure yet" },
                  { value: "commercial", name: "Commercial roofing" },
                ].map((s) => (
                  <label
                    className={form.service === s.value ? "selected" : ""}
                    key={s.value}
                  >
                    <input
                      required
                      type="radio"
                      name="service"
                      value={s.value}
                      checked={form.service === s.value}
                      onChange={() => set("service", s.value)}
                    />
                    {s.name}
                  </label>
                ))}
              </fieldset>
              <label className="rz-field">
                When are you hoping to get started?
                <select
                  value={form.urgency}
                  onChange={(e) => set("urgency", e.target.value)}
                >
                  {[
                    "Active leak / urgent",
                    "As soon as possible",
                    "Within a month",
                    "Just planning ahead",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              {form.urgency === "Active leak / urgent" && (
                <p className="rz-note">
                  This is not an emergency dispatch service. Do not wait for
                  this request if there is an immediate danger.
                </p>
              )}
              <div className="rz-fields">
                <label className="rz-field">
                  Property type
                  <select
                    value={form.propertyType}
                    onChange={(e) => set("propertyType", e.target.value)}
                  >
                    {[
                      "Single-family home",
                      "Townhome / duplex",
                      "Multi-family",
                      "Commercial building",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label className="rz-field">
                  Roof material
                  <select
                    value={form.roofMaterial}
                    onChange={(e) => set("roofMaterial", e.target.value)}
                  >
                    {[
                      "Not sure",
                      "Asphalt shingle",
                      "Metal",
                      "Tile",
                      "Flat / low-slope",
                      "Other",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="rz-field">
                Anything else we should know?{" "}
                <span className="rz-optional">Optional</span>
                <textarea
                  maxLength={2000}
                  rows={3}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="For example: a leak near the chimney after heavy rain."
                />
              </label>
            </>
          )}
          {step === 1 && (
            <>
              <p>
                Use the address where the work is needed. You can always enter
                it manually.
              </p>
              <AddressSearch
                onSelect={(address) => {
                  setForm((f) => ({ ...f, ...address }));
                  setZipStatus(
                    "Address selected. Please confirm all fields below.",
                  );
                }}
              />
              <label className="rz-field">
                ZIP code
                <input
                  required
                  inputMode="numeric"
                  autoComplete="postal-code"
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
              <p className="rz-field-help" role="status">
                {zipStatus}
              </p>
              <label className="rz-field">
                Street address
                <input
                  required
                  autoComplete="street-address"
                  minLength={5}
                  maxLength={180}
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="Street address and unit, if any"
                />
              </label>
              <div className="rz-fields">
                <label className="rz-field">
                  City
                  <input
                    required
                    autoComplete="address-level2"
                    maxLength={80}
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                  />
                </label>
                <label className="rz-field">
                  State
                  <select
                    required
                    autoComplete="address-level1"
                    value={form.state}
                    onChange={(e) => set("state", e.target.value)}
                  >
                    <option value="">Select state</option>
                    {states.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="rz-checkbox">
                <input
                  required
                  type="checkbox"
                  checked={form.authorized}
                  onChange={(e) => set("authorized", e.target.checked)}
                />
                I own this property or am authorized to request work for it.
              </label>
              <div className="rz-note">
                {form.city.toLowerCase() === "san antonio" &&
                form.state === "TX"
                  ? "San Antonio is our first pilot market. We’ll review your project and confirm whether a contractor introduction is possible."
                  : "We’re building our network. You can submit a request here, but we cannot promise a contractor connection in your area."}
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <p>
                RoofZeus uses these details to follow up about your project.
              </p>
              <label className="rz-field">
                Full name
                <input
                  required
                  autoComplete="name"
                  minLength={2}
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </label>
              <label className="rz-field">
                Email address
                <input
                  required
                  type="email"
                  autoComplete="email"
                  maxLength={180}
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </label>
              <label className="rz-field">
                Phone number{" "}
                <span className="rz-optional">
                  {form.contactMethod === "phone"
                    ? "Required for phone contact"
                    : "Optional"}
                </span>
                <input
                  type="tel"
                  required={form.contactMethod === "phone"}
                  autoComplete="tel"
                  maxLength={25}
                  pattern="[0-9+() .-]{10,25}"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </label>
              <label className="rz-field">
                How would you prefer to hear from us?
                <select
                  value={form.contactMethod}
                  onChange={(e) => set("contactMethod", e.target.value)}
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone call</option>
                </select>
              </label>
              <p className="rz-field-help">
                No automated marketing texts. No public profile.
              </p>
            </>
          )}
          {step === 3 && (
            <>
              <p>Check your details before sending your request.</p>
              <dl className="rz-review">
                <div>
                  <dt>
                    Project{" "}
                    <button type="button" onClick={() => setStep(0)}>
                      Edit
                    </button>
                  </dt>
                  <dd>
                    {services.find((s) => s.slug === form.service)?.name ||
                      (form.service === "commercial"
                        ? "Commercial roofing"
                        : "Not sure yet")}{" "}
                    · {form.urgency}
                    <small>
                      {form.propertyType} · {form.roofMaterial}
                    </small>
                    {form.notes && <small>{form.notes}</small>}
                  </dd>
                </div>
                <div>
                  <dt>
                    Property{" "}
                    <button type="button" onClick={() => setStep(1)}>
                      Edit
                    </button>
                  </dt>
                  <dd>
                    {form.address}
                    <small>
                      {form.city}, {form.state} {form.zip}
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>
                    Contact{" "}
                    <button type="button" onClick={() => setStep(2)}>
                      Edit
                    </button>
                  </dt>
                  <dd>
                    {form.name}
                    <small>
                      {form.email}
                      {form.phone ? ` · ${form.phone}` : ""}
                    </small>
                    <small>
                      Preferred:{" "}
                      {form.contactMethod === "email" ? "Email" : "Phone call"}
                    </small>
                  </dd>
                </div>
              </dl>
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
                By submitting, you accept our{" "}
                <Link to="/terms" target="_blank" rel="noopener">
                  Terms
                </Link>{" "}
                and acknowledge our{" "}
                <Link to="/privacy" target="_blank" rel="noopener">
                  Privacy Policy
                </Link>
                .
              </p>
              <BotCheck onToken={setToken} resetKey={resetKey} />
              {!intakeConfigured && (
                <div className="rz-note" role="status">
                  Online requests are opening soon. You can explore the steps,
                  but submissions are not available yet.
                </div>
              )}
            </>
          )}
          <label className="rz-honeypot" aria-hidden="true">
            Leave this empty
            <input
              tabIndex={-1}
              autoComplete="off"
              name="website"
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
            />
          </label>
          {error && (
            <p className="rz-error" role="alert">
              {error}
            </p>
          )}
          <div className="rz-form-actions">
            {step > 0 && (
              <button
                type="button"
                className="rz-back"
                disabled={busy}
                onClick={() => {
                  setError("");
                  setStep((s) => s - 1);
                }}
              >
                <ArrowLeft size={17} /> Back
              </button>
            )}
            <button
              className="rz-button"
              disabled={busy || (step === 3 && (!intakeConfigured || !token))}
            >
              {busy ? (
                <>
                  <Busy /> Sending…
                </>
              ) : step === 3 ? (
                <>
                  Send my request <ArrowRight size={18} />
                </>
              ) : (
                <>
                  Continue <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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
