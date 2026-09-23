import { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Check, LockKeyhole } from "lucide-react";
import LocationStart from "./LocationStart";
import type { Address } from "./location";
import EstimateFunnel from "./EstimateFunnel";
import ModernizeFunnel from "./ModernizeFunnel";
import { modernizeMode, useModernizeConfig } from "./modernize";
import AreaLabel from "./AreaLabel";
import LandingDetails from "./LandingDetails";
import { campaigns, type LandingVariant } from "./campaigns";
import { captureAttribution } from "./attribution";

export default function LandingPage({
  demo: forcedDemo = false,
  variant = "general",
}: {
  demo?: boolean;
  variant?: LandingVariant;
}) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const demo = forcedDemo || params.get("preview") === "1";
  const copy = campaigns[variant];
  const [attribution] = useState(() =>
    captureAttribution(location.pathname, location.search, demo),
  );
  const [propertyZip, setPropertyZip] = useState("");
  const [started, setStarted] = useState(false);
  const [initialAddress, setInitialAddress] = useState<Address>();
  const { config, loading } = useModernizeConfig(demo);
  const [demoZip, setDemoZip] = useState("");
  useEffect(() => {
    if (!demo) setStarted(params.get("estimate") === "1");
  }, [params, demo]);
  function start(zip: string, address?: Address) {
    setInitialAddress(address);
    if (demo) {
      setDemoZip(zip);
      setStarted(true);
    } else setParams({ zip, estimate: "1" });
  }
  return (
    <>
      <section className={`rz-estimate-hero ${started ? "funnel-open" : ""}`}>
        <img
          className="rz-estimate-house"
          src={copy.image}
          alt=""
          width={1400}
          height={933}
          fetchPriority="high"
        />
        <div className="rz-container rz-estimate-grid">
          <div className="rz-estimate-copy">
            {variant !== "general" && (
              <p className="rz-campaign-eyebrow">{copy.eyebrow}</p>
            )}
            <h1>
              {variant === "general" ? (
                <>
                  Get the right <br />
                  estimate for <br />
                  <span>your roof.</span>
                </>
              ) : (
                <>
                  {copy.headline}
                  <br />
                  <span>{copy.accent}</span>
                </>
              )}
            </h1>
            <p className="rz-estimate-subtitle">{copy.intro}</p>
            <div className="rz-estimate-checks">
              <span>
                <Check size={17} /> Free to get started
              </span>
              <span>
                <Check size={17} /> No obligation to hire
              </span>
            </div>
          </div>
          <div className="rz-estimate-panel" id="estimate-funnel">
            <header className="rz-area-banner" hidden={started}>
              <AreaLabel demo={demo} propertyZip={propertyZip} />
            </header>
            {demo && (
              <p className="rz-note" role="note">
                <strong>Demo mode.</strong> Use sample information. No estimate
                request will be saved or sent. Address lookup and consent
                recording are off.
              </p>
            )}
            {started && (demo || modernizeMode) ? (
              loading ? (
                <div className="rz-estimate-success" role="status">
                  Loading estimate options…
                </div>
              ) : (
                <ModernizeFunnel
                  demo={demo}
                  config={config}
                  zip={demo ? demoZip : params.get("zip") || ""}
                  initialAddress={initialAddress}
                  initialPlan={copy.initialPlan}
                  attribution={attribution}
                  onBack={() => {
                    if (demo) {
                      setInitialAddress(undefined);
                      setDemoZip("");
                      setStarted(false);
                    } else if (config.enabled)
                      window.location.assign(location.pathname);
                    else {
                      setInitialAddress(undefined);
                      setParams({});
                    }
                  }}
                />
              )
            ) : started ? (
              <EstimateFunnel
                initialAddress={initialAddress}
                initialService={variant === "general" ? "" : copy.path.slice(1)}
                attribution={attribution}
                onBack={() => {
                  setInitialAddress(undefined);
                  setParams({});
                }}
              />
            ) : (
              <div className="rz-estimate-entry">
                <p>
                  Enter your ZIP code or address to explore estimate options
                  near you.
                </p>
                {modernizeMode && !demo && !loading && !config.enabled && (
                  <p className="rz-form-disclosure rz-entry-notice" role="note">
                    Estimate requests are not open yet. You can explore the form
                    using sample details; nothing will be submitted.
                  </p>
                )}
                {modernizeMode &&
                  !demo &&
                  config.enabled &&
                  config.mode === "api" && (
                    <p className="rz-form-disclosure rz-entry-notice">
                      When you continue, TrustedForm records your form session,
                      including information you enter. Read our{" "}
                      <a href="/privacy" target="_blank" rel="noopener">
                        Privacy Policy
                      </a>
                      .
                    </p>
                  )}
                <LocationStart
                  onStart={start}
                  demo={demo}
                  onZipChange={setPropertyZip}
                  buttonLabel={
                    demo
                      ? "Start demo"
                      : modernizeMode && !config.enabled
                        ? "Preview the form"
                        : "Get my estimate"
                  }
                />
                <div className="rz-entry-privacy">
                  <LockKeyhole size={13} />
                  <span>You control your contact permission.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
      <section className="rz-estimate-benefits">
        <div className="rz-container">
          {[
            [
              "01",
              "Tell us what you need",
              "Your roof, your project, and your timing.",
            ],
            [
              "02",
              "Explore your options",
              "When requests are open, we check for available estimate help.",
            ],
            [
              "03",
              "Decide with confidence",
              "Talk through the work. Choose what’s right for you.",
            ],
          ].map(([n, t, p]) => (
            <div key={n}>
              <span>{n}</span>
              <div>
                <h2>{t}</h2>
                <p>{p}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <LandingDetails variant={variant} demo={demo} />
    </>
  );
}
