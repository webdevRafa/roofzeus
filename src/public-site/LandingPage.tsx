import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowRight, Check, LockKeyhole, ShieldCheck } from "lucide-react";
import LocationStart from "./LocationStart";
import type { Address } from "./location";
import EstimateFunnel from "./EstimateFunnel";
import ModernizeFunnel from "./ModernizeFunnel";
import { modernizeMode, useModernizeConfig } from "./modernize";

export default function LandingPage({ demo = false }: { demo?: boolean }) {
  const [params, setParams] = useSearchParams();
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
          src="/images/roof-home.webp"
          alt=""
          width={1400}
          height={933}
          fetchPriority="high"
        />
        <div className="rz-container rz-estimate-grid">
          <div className="rz-estimate-copy">
            <h1>
              Get the right <br />
              estimate for <br />
              <span>your roof.</span>
            </h1>
            <p className="rz-estimate-subtitle">
              A better roof starts with knowing your options.
              <br className="rz-desktop-break" /> Let’s find out what you
              need—starting with your ZIP code or address.
            </p>
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
                  onBack={() => {
                    if (demo) {
                      setInitialAddress(undefined);
                      setDemoZip("");
                      setStarted(false);
                    } else if (config.enabled) window.location.assign("/");
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
                onBack={() => {
                  setInitialAddress(undefined);
                  setParams({});
                }}
              />
            ) : (
              <div className="rz-estimate-entry">
                <h2>
                  Need help with <br />
                  your roof?
                </h2>
                <p>
                  Enter your ZIP code or address to explore estimate options
                  near you.
                </p>
                <LocationStart onStart={start} demo={demo} />
                <div className="rz-entry-privacy">
                  <LockKeyhole size={13} />
                  <span>You control your contact permission.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
      {!started && (
        <section className="rz-estimate-benefits">
          <div className="rz-container">
            {[
              [
                "01",
                "Tell us what you need",
                "A repair, a replacement, or just not sure.",
              ],
              [
                "02",
                "Explore your options",
                "We check whether local estimate help is available.",
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
      )}
      {!started && (
        <section className="rz-estimate-reassurance rz-container">
          <ShieldCheck size={25} />
          <div>
            <h2>Your home. Your budget. Your choice.</h2>
            <p>
              {modernizeMode
                ? "You choose who to hire. Review who may contact you before submitting your details."
                : "You choose who to hire. We ask before sharing your details with a named contractor."}
            </p>
          </div>
          <a href="#estimate-funnel">
            Get started <ArrowRight size={17} />
          </a>
        </section>
      )}
    </>
  );
}
