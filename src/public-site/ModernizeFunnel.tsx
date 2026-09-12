import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Info } from "lucide-react";
import { AddressSearch, BotCheck, Busy } from "./Widgets";
import { states, type Address } from "./location";
import { loadScript, lookupZip, track } from "./integrations";
import {
  submitModernize,
  closedConfig,
  SubmissionError,
  type ModernizeConfig,
  type ModernizeResult,
} from "./modernize";
import PropertyTextField from "./PropertyTextField";
import ConsentText from "./ConsentText";
import RoofingProjectFields from "./RoofingProjectFields";
import { useFunnelStep, revealFunnelStep } from "./useFunnelStep";
import { roofingProjectReady } from "./roofing-project";
import { EmailField, PhoneField } from "./ContactInputs";
import {
  normalizeEmail,
  normalizePhone,
} from "../../functions/src/contact-validation";

export default function ModernizeFunnel({
  config: suppliedConfig,
  demo = false,
  zip,
  initialAddress,
  onBack,
}: {
  config: ModernizeConfig;
  demo?: boolean;
  zip: string;
  initialAddress?: Address;
  onBack: () => void;
}) {
  // The review route cannot inherit live delivery settings.
  const config = demo ? closedConfig : suppliedConfig;
  const [demoCompleted, setDemoCompleted] = useState(false);
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
  const { step, setStep, transitioning, motionRef } = useFunnelStep();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false),
    [token, setToken] = useState("");
  const [reset, setReset] = useState(0),
    [certificate, setCertificate] = useState("");
  const [certificateFailed, setCertificateFailed] = useState(false);
  const [result, setResult] = useState<ModernizeResult>();
  const [locked, setLocked] = useState(false);
  const [checkedContact, setCheckedContact] = useState("");
  const contactSnapshot = JSON.stringify([
    form.firstName,
    form.lastName,
    form.email,
    form.phone,
  ]);
  const requestId = useRef("");
  const submitted = useRef<Record<string, unknown> | null>(null);
  const formElement = useRef<HTMLFormElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  useEffect(() => {
    requestId.current = crypto.randomUUID();
    if (!demo) track("estimate_started");
  }, [demo]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    revealFunnelStep();
  }, [step, result, demoCompleted]);
  useEffect(() => {
    if (demo || !/^\d{5}$/.test(form.zip)) return;
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
  }, [form.zip, demo]);
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
    if (demo || busy || !config.enabled) return;
    if (
      !locked &&
      (!normalizeEmail(form.email) || !normalizePhone(form.phone))
    ) {
      setError(
        "Please enter a valid email address and a 10-digit U.S. phone number.",
      );
      formElement.current?.reportValidity();
      return;
    }
    if (!locked && !roofingProjectReady(form, config.materials)) {
      setError(
        "Please choose an available roofing project, material, and timing.",
      );
      setStep(0);
      return;
    }
    setBusy(true);
    setError("");
    if (!submitted.current)
      submitted.current = {
        ...form,
        email: normalizeEmail(form.email),
        phone: normalizePhone(form.phone),
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

  if (demoCompleted)
    return (
      <div className="rz-estimate-success">
        <CheckCircle2 size={44} aria-hidden="true" />
        <h2 ref={heading} tabIndex={-1}>
          Demo completed successfully.
        </h2>
        <p>
          You’ve reached the end of the estimate form. In the live service, your
          request would be checked for available roofing estimate options.
        </p>
        <p className="rz-note">
          No lead was saved or sent to Modernize or contractors. This is a
          demonstration, not an accepted request or a confirmed match.
        </p>
        <p className="rz-field-help">
          Contact permission and verification will appear in the live flow after
          the required setup and review.
        </p>
        <button
          type="button"
          className="rz-button rz-estimate-next"
          onClick={onBack}
        >
          Try the demo again <ArrowRight size={18} />
        </button>
      </div>
    );
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
  const supported = roofingProjectReady(form, config.materials);
  return (
    <div
      className="rz-estimate-steps"
      ref={motionRef}
      aria-busy={transitioning}
    >
      <div className="rz-estimate-step-top">
        <button
          type="button"
          disabled={busy || locked || transitioning}
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
          if (transitioning) return;
          if (step === 2 && !config.enabled) {
            if (
              normalizeEmail(form.email) &&
              normalizePhone(form.phone) &&
              form.firstName.trim() &&
              form.lastName.trim()
            ) {
              if (demo) {
                setDemoCompleted(true);
                setForm((current) => ({
                  ...current,
                  firstName: "",
                  lastName: "",
                  email: "",
                  phone: "",
                  address: "",
                  city: "",
                  state: "",
                  zip: "",
                }));
              } else setCheckedContact(contactSnapshot);
              setError("");
            } else
              setError(
                "Please check your name, email address, and phone number.",
              );
          } else if (step === 2) void send();
          else if (supported) {
            setError("");
            setStep(step + 1);
          } else {
            setError(
              "Please choose a roofing project, material, and timing to continue.",
            );
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
        {!config.enabled && !demo && (
          <p className="rz-note">
            Preview only. Estimate requests aren’t open yet. You can check your
            details, but nothing will be submitted.
          </p>
        )}
        <fieldset disabled={busy || locked} className="rz-modernize-fields">
          {step === 0 && (
            <RoofingProjectFields
              project={form}
              materials={config.materials}
              onChange={(patch) => {
                setError("");
                setForm((current) => ({ ...current, ...patch }));
              }}
            />
          )}
          {step === 1 && (
            <>
              <p>Confirm your property details. You can edit anything below.</p>
              {!demo && (
                <AddressSearch
                  onSelect={(address) =>
                    setForm((current) => ({ ...current, ...address }))
                  }
                />
              )}
              <PropertyTextField
                name="address"
                value={form.address}
                onChange={(value) => set("address", value)}
              />
              <PropertyTextField
                name="city"
                value={form.city}
                onChange={(value) => set("city", value)}
              />
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
                  : demo
                    ? "Use sample details to complete the demo. No one will contact you."
                    : "Try the contact fields below to check their format."}
              </p>
              <div className="rz-fields">
                <label className="rz-field">
                  First name
                  <input
                    name="firstName"
                    autoComplete="given-name"
                    required
                    pattern={".*\\S.*"}
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
                    pattern={".*\\S.*"}
                    maxLength={80}
                    value={form.lastName}
                    onChange={(event) => set("lastName", event.target.value)}
                  />
                </label>
              </div>
              <EmailField
                value={form.email}
                onChange={(value) => set("email", value)}
              />
              <PhoneField
                value={form.phone}
                onChange={(value) => set("phone", value)}
              />
              <p className="rz-field-help">
                {demo
                  ? "This demo does not request permission for marketing contact. Read our "
                  : "RoofZeus may receive compensation for this referral. Availability varies. Read our "}
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
        {step === 2 &&
          !config.enabled &&
          checkedContact === contactSnapshot && (
            <p role="status" className="rz-note">
              Format checks passed. This is a preview; your details have not
              been submitted. These checks don’t verify that an email inbox or
              phone number is reachable.
            </p>
          )}
        {step === 2 && config.enabled && (!token || !certificate) && (
          <p role="status" className="rz-field-help">
            {certificateFailed
              ? "Submission is unavailable because form verification failed. Reload the page to try again."
              : "Complete the security verification and allow form verification to finish to enable submission."}
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
            <ConsentText
              text={config.consentText}
              advertiser={config.consentAdvertiserName}
            />
          </label>
        )}
        <button
          name="submit"
          type="submit"
          className="rz-button rz-estimate-next"
          data-tf-element-role={step === 2 ? "submit" : undefined}
          disabled={
            busy ||
            transitioning ||
            (step > 0 && !supported && !locked) ||
            (step === 2 && config.enabled && (!token || !certificate))
          }
        >
          {busy ? (
            <>
              <Busy /> Checking…
            </>
          ) : (
            <>
              {step === 2
                ? !config.enabled
                  ? demo
                    ? "Complete demo"
                    : "Check my details"
                  : locked
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
