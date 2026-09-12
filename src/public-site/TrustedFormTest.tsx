import { useState } from "react";
import ModernizeFunnel from "./ModernizeFunnel";
import { closedConfig } from "./modernize";

/** Local development tool only. Never obtains an enabled delivery config. */
export default function TrustedFormTest() {
  const [started, setStarted] = useState(false);
  if (
    !import.meta.env.DEV ||
    typeof window === "undefined" ||
    !["localhost", "127.0.0.1"].includes(window.location.hostname)
  )
    return <p>This test is available only on localhost in development.</p>;
  return (
    <section
      className="rz-container"
      style={{ maxWidth: 720, paddingBlock: 32 }}
    >
      <h1>TrustedForm sandbox test</h1>
      <p className="rz-note">
        Starting this test loads ActiveProspect TrustedForm, which records this
        page and your form interactions on its servers. Use sample information
        only. Nothing is sent to Modernize or saved in Firebase. This uses test
        consent, not approved marketing consent.{" "}
        <a href="/privacy" target="_blank" rel="noreferrer">
          Privacy policy
        </a>
        .
      </p>
      <p>
        Sample property: 123 Example Lane, San Antonio, TX 78209. Sample
        contact: Synthetic Homeowner, synthetic@example.com, (210) 555-0123.
      </p>
      <p>
        Keep this tab on this test until finished. Close or reload the page to
        end the session; use a fresh reload for each new certificate.
      </p>
      {!started ? (
        <button className="rz-button" onClick={() => setStarted(true)}>
          Start sandbox recording
        </button>
      ) : (
        <div className="rz-estimate-panel">
          <ModernizeFunnel
            demo
            certificateTest
            config={closedConfig}
            zip="78209"
            onBack={() => window.location.reload()}
          />
        </div>
      )}
    </section>
  );
}
