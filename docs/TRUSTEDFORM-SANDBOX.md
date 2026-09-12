# TrustedForm certificate test before Modernize approval

The ActiveProspect Setup checkboxes generate a snippet. Changing or revisiting
that page does not change a URL already saved in Firebase. The sandbox URL is:

```text
https://api.trustedform.com/trustedform.js?field=xxTrustedFormCertUrl&use_tagged_consent=true&sandbox=true
```

The dashboard snippet also appends a timestamp/random cache-busting parameter.
That value is not an account credential or a certificate ID. The `sandbox=true`
parameter is what enables sandbox recording.

## Run the isolated test on Windows

From a clean checkout of main, in PowerShell:

```powershell
git pull --ff-only origin main
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 5177 --strictPort
```

Leave the terminal running and open `http://127.0.0.1:5177/trustedform-test`.
Read the recording notice, then click **Start sandbox recording**. This loads
the actual third-party SDK, which records the page and interactions on
ActiveProspect's servers. Use synthetic information only:

- Project: roof replacement, asphalt shingles, immediately.
- Property: 123 Example Lane, San Antonio, TX 78209 (sample, not verified).
- Contact: Synthetic Homeowner, synthetic@example.com, (210) 555-0123.
- Check the test-only consent and click **Finish certificate test**.

Open the generated certificate using **Open test certificate** while signed
into ActiveProspect. Check the replay, inputs, and test consent tags. Certificate
generation alone does not prove replay accuracy or Modernize acceptance.
Localhost is not your verified roofzeus.com domain; if ActiveProspect restricts
viewing, record that limitation and arrange a controlled test on a verified
staging domain with ActiveProspect/Modernize before launch. Do not purchase Retain
to try to claim a sandbox certificate: sandbox certificates cannot be claimed.

Reload for a new session. The test calls the SDK's documented stop function after
submission when available; closing/reloading ends the page session. Press Ctrl+C
in PowerShell when finished.

## Isolation and limits

- Route is available only in Vite development on localhost/127.0.0.1; it is absent
  from production builds. No public Vercel route is deployed for this test.
- Uses the existing Modernize form with closed delivery settings. The completion
  path never calls the gateway and does not store lead details in Firebase or
  browser storage. No Google address lookup, ZIP API, Turnstile, or lead analytics.
- SDK sandbox URL is fixed, not inherited from cloud settings or a query string.
- Uses clearly labeled test consent, not an assertion of approved consent language.
- Public `/demo` remains recording-free. Production approval checks stay intact.
- This test requires no Firebase deployment, new secrets, or enabled approval flags.
  Keep the saved `MODERNIZE_SETTINGS` environment disabled.

## Verification performed

Automated browser checks exercise opt-in loading, sandbox parameters, successful
completion, no delivery/storage, a blocked SDK and a cleared certificate field.
A separate real-SDK run with synthetic details generated a certificate URL on
localhost. Account-authenticated replay and Modernize acceptance remain manual
launch checks; no partner lead was sent.

References: [SDK implementation](https://developers.activeprospect.com/pages/trustedform/implementing-trustedform-certify)
and [Certify / SPA stop recording](https://support.activeprospect.com/hc/en-us/articles/44098177422996-TrustedForm-Certify).
