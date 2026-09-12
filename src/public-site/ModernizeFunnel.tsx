import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Info } from "lucide-react";
import { AddressSearch, BotCheck, Busy } from "./Widgets";
import { states, type Address } from "./location";
import { loadScript, lookupZip, track } from "./integrations";
import {
  roofMaterials,
  submitModernize,
  SubmissionError,
  type ModernizeConfig,
  type ModernizeResult,
} from "./modernize";

export default function ModernizeFunnel({
  config,
  zip,
  initialAddress,
  onBack,
}: {
  config: ModernizeConfig;
  zip: string;
  initialAddress?: Address;
  onBack: () => void;
}) {
  const [form, setForm] = useState({
    plan: "",
    material: "",
    timeframe: "",
    authorized: false,
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    consent: false,
    website: "",
    address: "",
    city: "",
    state: "",
    zip,
    ...initialAddress,
  });
  const [step, setStep] = useState(0),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false),
    [token, setToken] = useState("");
  const [reset, setReset] = useState(0),
    [certificate, setCertificate] = useState("");
  const [certificateFailed, setCertificateFailed] = useState(false);
  const [result, setResult] = useState<ModernizeResult>();
  const [locked, setLocked] = useState(false);
  const requestId = useRef("");
  const submitted = useRef<Record<string, unknown> | null>(null);
  const formElement = useRef<HTMLFormElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  useEffect(() => {
    requestId.current = crypto.randomUUID();
    track("estimate_started");
  }, []);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    if (step > 0 || result)
      document
        .getElementById("estimate-funnel")
        ?.scrollIntoView({ block: "start" });
  }, [step, result]);
  useEffect(() => {
    if (!/^\d{5}$/.test(form.zip)) return;
    const controller = new AbortController();
    const timer = setTimeout(
      () =>
        lookupZip(form.zip, controller.signal)
          .then((place) => {
            if (place)
              setForm((current) => ({
                ...current,
                city: current.city || place.city,
                state: current.state || place.state,
              }));
          })
          .catch(() => {}),
      300,
    );
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [form.zip]);
  useEffect(() => {
    if (!config.enabled || config.mode !== "api" || !formElement.current)
      return;
    let active = true;
    // The single persistent form exists before loading the account-provided SDK.
    try {
      const url = new URL(config.trustedFormScriptUrl);
      if (
        url.protocol !== "https:" ||
        url.hostname !== "api.trustedform.com" ||
        url.pathname !== "/trustedform.js"
      )
        throw Error();
      void loadScript(url.href).catch(() => {
        if (active) setCertificateFailed(true);
      });
    } catch {
      setCertificateFailed(true);
    }
    const interval = setInterval(() => {
      const value =
        formElement.current?.querySelector<HTMLInputElement>(
          'input[name="xxTrustedFormCertUrl"]',
        )?.value || "";
      if (/^https:\/\/cert\.trustedform\.com\/[a-f0-9]{40}$/i.test(value)) {
        setCertificate(value);
        setCertificateFailed(false);
      }
    }, 250);
    const timeout = setTimeout(() => {
      if (
        !formElement.current?.querySelector<HTMLInputElement>(
          'input[name="xxTrustedFormCertUrl"]',
        )?.value
      )
        setCertificateFailed(true);
    }, 20000);
    return () => {
      active = false;
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [config]);

  async function send() {
    if (busy || !config.enabled) return;
    setBusy(true);
    setError("");
    if (!submitted.current)
      submitted.current = {
        ...form,
        requestId: requestId.current,
        configVersion: config.version,
        consentVersion: config.consentVersion,
        trustedFormToken: certificate,
      };
    setLocked(true);
    try {
      const response = await submitModernize({
        ...submitted.current,
        turnstileToken: token,
      });
      setResult(response);
      if (response.status === "accepted") track("estimate_partner_accepted");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "We could not confirm your request. Check its status before starting another.",
      );
      // Explicit validation failures occur before delivery reservation; allow correction.
      if (
        failure instanceof SubmissionError &&
        [400, 422, 429].includes(failure.status)
      ) {
        setLocked(false);
        submitted.current = null;
      }
      setToken("");
      setReset((value) => value + 1);
    } finally {
      setBusy(false);
    }
  }

  if (config.mode === "hosted")
    return (
      <div className="rz-estimate-success">
        <h2>Continue your estimate search</h2>
        <p>
          You’ll continue on Modernize’s website to provide your project details
          and review its contact permissions.
        </p>
        <p>
          RoofZeus may earn a referral fee. Your address and contact details are
          not sent by this link.
        </p>
        {config.enabled && config.affiliateUrl ? (
          <a
            className="rz-button rz-estimate-next"
            href={config.affiliateUrl}
            rel="sponsored noreferrer"
            referrerPolicy="no-referrer"
          >
            Continue to Modernize <ArrowRight size={18} />
          </a>
        ) : (
          <p className="rz-note">
            Estimate matching is opening soon. We’re not accepting requests yet.
          </p>
        )}
        <button className="rz-text-link" onClick={onBack}>
          Back
        </button>
      </div>
    );
  if (result) {
    const accepted = result.status === "accepted";
    const pending = ["processing", "unknown"].includes(result.status);
    return (
      <div className="rz-estimate-success">
        {accepted ? <CheckCircle2 size={44} /> : <Info size={40} />}
        <h2 ref={heading} tabIndex={-1}>
          {accepted
            ? "Your request is on its way."
            : pending
              ? "We’re checking your request."
              : "We couldn’t arrange a match."}
        </h2>
        {result.environment === "staging" && (
          <p className="rz-note">
            Test submission only. No real contractor introduction or payout.
          </p>
        )}
        <p>
          {accepted
            ? "Modernize accepted your request. Contact may follow as described in the permission you reviewed. An estimate, appointment, or price is not confirmed."
            : pending
              ? "Your request is recorded, but we can’t yet confirm its delivery to Modernize. Please don’t submit it again as a new request."
              : "We couldn’t confirm an available match for this request. No appointment has been booked. You can contact a local roofing company directly."}
        </p>
        <p>
          Your reference: <strong>{result.reference}</strong>
        </p>
        {pending && (
          <button
            className="rz-button rz-estimate-next"
            disabled={busy}
            onClick={() => void send()}
          >
            {busy ? "Checking…" : "Check status"}
          </button>
        )}
        {error && (
          <p role="alert" className="rz-error">
            {error}
          </p>
        )}
        <p className="rz-field-help">
          For help or to withdraw your request, email{" "}
          <a href="mailto:privacy@roofzeus.com">privacy@roofzeus.com</a> with
          this reference.
        </p>
        <a className="rz-text-link" href="/">
          Back to home
        </a>
      </div>
    );
  }
  const supported = form.material !== "unknown" && form.plan !== "unsure";
  return (
    <div className="rz-estimate-steps">
      <div className="rz-estimate-step-top">
        <button
          type="button"
          disabled={busy || locked}
          onClick={() => {
            setError("");
            if (step > 0) setStep(step - 1);
            else onBack();
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
        ref={formElement}
        data-tf-element-role="offer"
        onSubmit={(event) => {
          event.preventDefault();
          if (step === 2) void send();
          else if (supported) {
            setError("");
            setStep(step + 1);
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
        {config.enabled && config.environment === "staging" && (
          <p className="rz-note">
            Local test mode. Use synthetic details only.
          </p>
        )}
        <fieldset disabled={busy || locked} className="rz-modernize-fields">
          {step === 0 && (
            <>
              <p>A few details help us find the right type of roofing help.</p>
              <fieldset className="rz-choice-grid">
                <legend className="rz-sr-only">Roofing need</legend>
                {[
                  ["repair", "Roof repair"],
                  ["replacement", "Roof replacement"],
                  ["new", "New construction"],
                  ["unsure", "Inspection / not sure"],
                ].map(([value, label]) => (
                  <label
                    key={value}
                    className={form.plan === value ? "selected" : ""}
                  >
                    <input
                      id={`modernize-plan-${value}`}
                      name="plan"
                      type="radio"
                      value={value}
                      required
                      checked={form.plan === value}
                      onChange={() => set("plan", value)}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              <label className="rz-field">
                Roof material
                <select
                  name="material"
                  required
                  value={form.material}
                  onChange={(event) => set("material", event.target.value)}
                >
                  <option value="">Choose material</option>
                  {Object.entries(roofMaterials)
                    .filter(
                      ([key]) =>
                        !config.enabled || config.materials.includes(key),
                    )
                    .map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  <option value="unknown">Not sure / another material</option>
                </select>
              </label>
              <label className="rz-field">
                When do you need help?
                <select
                  name="timeframe"
                  required
                  value={form.timeframe}
                  onChange={(event) => set("timeframe", event.target.value)}
                >
                  <option value="">Choose timing</option>
                  <option value="Immediately">As soon as possible</option>
                  <option value="1-6 months">Within 1–6 months</option>
                  <option value="Don't know">Just planning / not sure</option>
                </select>
              </label>
              {!supported && (
                <p className="rz-note" role="status">
                  This matching flow needs a known roof material and a repair,
                  replacement, or new roof. If you’re unsure, a local roofer can
                  help identify what you need. We won’t submit an assumed
                  answer.
                </p>
              )}
              <p className="rz-field-help">
                For residential properties. This is not an emergency dispatch
                service.
              </p>
            </>
          )}
          {step === 1 && (
            <>
              <p>Confirm your property details. You can edit anything below.</p>
              <AddressSearch
                onSelect={(address) =>
                  setForm((current) => ({ ...current, ...address }))
                }
              />
              <label className="rz-field">
                Street address
                <input
                  name="address"
                  autoComplete="street-address"
                  required
                  minLength={5}
                  maxLength={180}
                  value={form.address}
                  onChange={(event) => set("address", event.target.value)}
                />
              </label>
              <label className="rz-field">
                City
                <input
                  name="city"
                  autoComplete="address-level2"
                  required
                  minLength={2}
                  maxLength={80}
                  value={form.city}
                  onChange={(event) => set("city", event.target.value)}
                />
              </label>
              <div className="rz-fields">
                <label className="rz-field">
                  State
                  <select
                    name="state"
                    autoComplete="address-level1"
                    required
                    value={form.state}
                    onChange={(event) => set("state", event.target.value)}
                  >
                    <option value="">Select</option>
                    {states.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="rz-field">
                  ZIP code
                  <input
                    name="zip"
                    autoComplete="postal-code"
                    required
                    inputMode="numeric"
                    pattern="[0-9]{5}"
                    maxLength={5}
                    value={form.zip}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        zip: event.target.value.replace(/\D/g, ""),
                        city: "",
                        state: "",
                      }))
                    }
                  />
                </label>
              </div>
              <label className="rz-checkbox">
                <input
                  name="authorized"
                  type="checkbox"
                  required
                  checked={form.authorized}
                  onChange={(event) => set("authorized", event.target.checked)}
                />
                I own this property or am authorized to arrange work for it.
              </label>
            </>
          )}
          {step === 2 && (
            <>
              <p>
                {config.enabled
                  ? "Review your details and the contact permission below before submitting."
                  : "Estimate matching is opening soon. You can explore the form, but we’re not accepting requests yet."}
              </p>
              <div className="rz-fields">
                <label className="rz-field">
                  First name
                  <input
                    name="firstName"
                    autoComplete="given-name"
                    required
                    maxLength={80}
                    value={form.firstName}
                    onChange={(event) => set("firstName", event.target.value)}
                  />
                </label>
                <label className="rz-field">
                  Last name
                  <input
                    name="lastName"
                    autoComplete="family-name"
                    required
                    maxLength={80}
                    value={form.lastName}
                    onChange={(event) => set("lastName", event.target.value)}
                  />
                </label>
              </div>
              <label className="rz-field">
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={180}
                  value={form.email}
                  onChange={(event) => set("email", event.target.value)}
                />
              </label>
              <label className="rz-field">
                Phone number
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  pattern="[0-9+() .-]{10,25}"
                  maxLength={25}
                  value={form.phone}
                  onChange={(event) => set("phone", event.target.value)}
                />
              </label>
              <p className="rz-field-help">
                RoofZeus may receive compensation for this referral.
                Availability varies. Read our{" "}
                <a href="/privacy" target="_blank" rel="noopener">
                  Privacy Policy
                </a>{" "}
                and{" "}
                <a href="/terms" target="_blank" rel="noopener">
                  Terms
                </a>
                .
              </p>
            </>
          )}
        </fieldset>
        <label className="rz-honeypot" aria-hidden="true">
          Leave empty
          <input
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(event) => set("website", event.target.value)}
          />
        </label>
        {step === 2 && config.enabled && (
          <>
            <BotCheck onToken={setToken} resetKey={reset} />
            {certificateFailed && (
              <p role="alert" className="rz-error">
                Form verification could not load. Please reload or check your
                browser’s content-blocking settings.
              </p>
            )}
            {!certificate && !certificateFailed && (
              <p role="status" className="rz-field-help">
                Preparing form verification…
              </p>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="rz-error">
            {error}
          </p>
        )}
        {locked && (
          <p className="rz-note">
            Your details are held for this submission. Check its status before
            starting another request.
          </p>
        )}
        {step === 2 && config.enabled && (
          <label
            className="rz-checkbox rz-modernize-consent"
            data-tf-element-role="consent-language"
          >
            <input
              name="consent"
              type="checkbox"
              required
              disabled={busy || locked}
              checked={form.consent}
              onChange={(event) => set("consent", event.target.checked)}
              data-tf-element-role="consent-opt-in"
            />
            <span>{config.consentText}</span>
          </label>
        )}
        <button
          name="submit"
          type="submit"
          className="rz-button rz-estimate-next"
          data-tf-element-role={step === 2 ? "submit" : undefined}
          disabled={
            busy ||
            !supported ||
            (step === 2 && (!config.enabled || !token || !certificate))
          }
        >
          {busy ? (
            <>
              <Busy /> Checking…
            </>
          ) : (
            <>
              {step === 2
                ? locked
                  ? "Check submission status"
                  : "Get my estimate"
                : "Continue"}
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>
      {config.enabled && (
        <p className="rz-field-help rz-verification-notice">
          This form uses TrustedForm to document your interaction and contact
          permission. <a href="/privacy">Learn more</a>.
        </p>
      )}
    </div>
  );
}
