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

## September 12, 2026 investigation

- Fresh real-SDK RoofZeus recordings (bulk input and character-by-character typing)
  produced valid sandbox certificates. The live contact step and completed replay
  each contained one first-name input, one last-name input, and one form.
- The originally reported certificate also showed one contact section when played
  from start to finish in a fresh diagnostic browser. The screenshot duplication
  was not reproduced; its cause remains unresolved. Timeline-seeking inspection
  was inconclusive because the player's overlays intercepted the test clicks.
- One native final submit event was observed in the live RoofZeus form, while
  TrustedForm's event log displayed two submitted-form entries. A separate plain
  HTML form with no React, gateway, Firebase, or explicit stop-recording call also
  produced two entries from one native submit. These entries do not establish
  duplicate lead delivery. At the time of these tests, Continue buttons also
  generated native submit events for step validation. The follow-up fix below
  removes those premature native submissions.
- Entering the exact synthetic email in the certificate viewer returned HTTP 401
  from `POST /<certificate>/unlock/`, with `Unauthorized` in the JSON response.
  This reproduced in both RoofZeus and the independent plain HTML sandbox test.
  The diagnostic browser was not account-authenticated. The user independently
  reported the same error in their normal Chrome session. We have not established
  whether this is an account requirement, localhost/sandbox restriction, or a
  service defect. Do not infer the cause from the status code alone.
- RoofZeus diagnostic network traffic allowed only localhost and TrustedForm;
  no Modernize or Firebase requests occurred. Keep delivery disabled pending
  approvals and a successful end-to-end acceptance test.

Ask ActiveProspect support to explain sandbox/localhost manual-unlock behavior
and the duplicate event entries. Supply a fresh synthetic certificate privately
before its three-day expiry. Do not publish personal-data certificate links or
buy Retain to work around this. See their
[manual lead matching instructions](https://support.activeprospect.com/hc/en-us/articles/44098376178836-Lead-Matching-When-Viewing-A-Certificate).

The local test now focuses and scrolls to its completion message. Three targeted
browser checks cover successful isolated completion, SDK failure, and a missing
certificate at submission.

## Submission and recording lifecycle follow-up

Controlled plain HTML comparisons isolated two paths in the event log: a normal
submit-button click produced two visible "submitted form" rows, a native submit
without a click produced one, and a tagged button click without native submission
produced one. Each case loaded the SDK once. A full RoofZeus test before the fix
produced three native submissions and six rows (two per Continue/final click).

ActiveProspect's [event-log guide](https://support.activeprospect.com/hc/en-us/articles/39110646910740-Interpreting-the-TrustedForm-Event-Log)
explicitly explains that Next/Continue clicks can be labeled "submitted form".
These labels are not a count of native submissions or delivered leads. Do not
remove required consent tags, suppress SDK events, or use an invalid button type
to manipulate the log. The final action remains a native submit button with the
required [submit consent tag](https://developers.activeprospect.com/pages/trustedform/consent-tagging).

The corrected flow:

- Earlier Continue controls use `type="button"`, validate current fields, and
  advance without native submit events. Enter in earlier text fields follows the
  same validation; final-step Enter remains a native submission. Separate keyed
  controls prevent a reduced-motion transition from turning a navigation click
  into final submission.
- The submitted action and its consent evidence stay mounted and disabled while
  the gateway is working. Receipt checks use a separate untagged button, preserve
  the original request and certificate, and do not emit another native submit.
- A synchronous in-flight guard prevents repeated events from issuing concurrent
  requests before the disabled state renders. Server receipt/idempotency checks
  remain the final duplicate-delivery protection.
- Recording stops once a gateway result arrives, before the consent form is
  replaced. Validation errors leave it running so corrections can be recorded.
- Leaving the form stops its recording. The same document cannot reuse the
  recording for a new form; returning through browser history offers a reload.
  StrictMode effect replay does not stop an active recording, and a script that
  finishes loading after navigation is stopped as well.
- Phone formatting restores the cursor in the same render commit. A delayed
  animation-frame callback can no longer overwrite a subsequent Select All and
  cause Backspace to delete only one digit.

Regression checks cover native submission counts, required fields, keyboard and
reduced-motion behavior, concurrent events, receipt-only retries, validation
correction, single SDK loading, history navigation and delayed SDK loading.
The real-SDK event log may still label navigation clicks and the final click as
submissions. Verify native event counts and gateway requests separately.

The manual viewer's Unauthorized response remains unresolved. Nothing in these
changes establishes that submission-event labels caused that authorization error.
Production approval, account-specific consent/Jornaya requirements, and an
authorized Modernize staging acceptance test remain launch prerequisites.

Post-fix validation on September 12: all 29 Modernize browser checks, 52 backend
checks, six public-build checks, the production build, and targeted lint passed.
A fresh real-SDK sandbox run on the patched local source generated a certificate
with one SDK load, zero native Continue submissions, and one native final submit.
The event log showed four rows: one for each Continue click and two for the final
click/native-submit pair. This matches the observed distinction between viewer
labels and actual native submits. No Firebase or Modernize request was made.
