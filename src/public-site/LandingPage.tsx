import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  LockKeyhole,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import LocationStart from "./LocationStart";
import type { Address } from "./location";
import EstimateFunnel from "./EstimateFunnel";

export default function LandingPage() {
  const [params, setParams] = useSearchParams();
  const [started, setStarted] = useState(false);
  const [initialAddress, setInitialAddress] = useState<Address>();
  useEffect(() => {
    setStarted(params.get("estimate") === "1");
  }, [params]);
  function start(zip: string, address?: Address) {
    setInitialAddress(address);
    setParams({ zip, estimate: "1" });
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
            <p className="rz-estimate-kicker">ROOF REPAIR & REPLACEMENT</p>
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
            {started ? (
              <EstimateFunnel
                initialAddress={initialAddress}
                onBack={() => {
                  setInitialAddress(undefined);
                  setParams({});
                }}
              />
            ) : (
              <div className="rz-estimate-entry">
                <div className="rz-entry-icon">
                  <MapPin size={26} />
                </div>
                <p className="rz-entry-eyebrow">LET’S START WITH YOUR AREA</p>
                <h2>
                  Need help with <br />
                  your roof?
                </h2>
                <p>
                  Enter your ZIP code or address to explore estimate options
                  near you.
                </p>
                <LocationStart onStart={start} />
                <div className="rz-entry-privacy">
                  <LockKeyhole size={13} />
                  <span>Your information stays private.</span>
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
              You choose who to hire. We ask before sharing your details with a
              named contractor.
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
