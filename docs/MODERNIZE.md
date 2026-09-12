# RoofZeus / Modernize implementation plan

Current audit and additional consent settings: see [MODERNIZE-READINESS.md](MODERNIZE-READINESS.md). The audit addendum supersedes older setup examples where noted.

Status: contract, homeowner flow, secure delivery, hosted handoff, and operator review implemented; mocked verification in place. No publisher approval or credentials supplied. Live delivery remains disabled. This integration is based on public documentation, not a certification or endorsement by Modernize. Live staging, certificate review, and production acceptance require the account manager.

## Milestones

1. Contract and configuration: documented roofing fields, strict environment gates, account-specific consent, hosted-referral option, deterministic payload mapping, mocked contract tests.
2. Delivery and homeowner experience: single-page form, TrustedForm certificate capture, secure server-side Ping/Post, private delivery receipts, duplicate/rate protection, honest outcomes. Keep the existing contractor app isolated.
3. Verification and operations: failure/concurrency/browser tests, production build, setup checklist, delivery review tooling, final GitHub push.

## Confirmed requirements and open dependencies

Reviewed September 12, 2026:

- [Modernize affiliate program](https://modernize.com/affiliates): application and approval; affiliate links available. No published promise of acceptance, payout, or traffic minimum.
- [Modernize Ping/Post documentation](https://apidoc.modernize.com/publishers/ping-post.html): account authorization for each service; account/environment-specific tagId; staging testing before production approval. Ping offers non-contact project data; Post sends the full lead only after a valid ping. A ping is not a completed sale. Post success requires a leadId. Tokens expire after 30 minutes.
- Roof material determines the service code; RoofingPlan must explicitly distinguish repair, replacement, and new construction. Never infer an unknown material or turn an inspection request into a replacement.
- Post requires first and last name, phone, email, address, city, state, ZIP, the exact displayed consent text, and a TrustedForm certificate. Some account/service configurations may also require Jornaya. The public documentation does not provide an account-specific consent/advertiser-selection contract; obtain that from the account manager. This implementation supports approved static text only and stays disabled if dynamic advertiser consent or Jornaya is required.
- [TrustedForm implementation](https://developers.activeprospect.com/pages/trustedform/implementing-trustedform-certify): obtain the SDK snippet from your own Certify account; mount the form before the script; use one SPA form for the flow; transmit its certificate. Sandbox certificates cannot be claimed.
- [TrustedForm consent tags](https://developers.activeprospect.com/pages/trustedform/consent-tagging): tag offer, consent language, opt-in, and final submit. Account manager must review a real certificate and rendered form before launch.

## Design decisions

- U.S. ZIP/address entry with no promise of nationwide buyer coverage. No global expansion, invented contractors, or fake accepted leads.
- New Modernize submissions use a separate collection and consent contract. Never forward existing RoofZeus manual-intake records under their old permission.
- All Modernize calls originate on the server. Production is opt-in; absent/invalid settings fail closed. No credentials in VITE variables or source control.
- Keep direct API and hosted-referral modes mutually exclusive. Hosted mode uses the exact approved link; never append homeowner PII or arbitrary query parameters.
- Durable reservation before outbound calls. Retries retrieve the existing outcome; they do not automatically resell a lead. An uncertain Post result requires operator reconciliation, not blind retries.
- No contractor portal, payment checkout, billing integration, or lead auction is required: Modernize manages its buyers and publisher payout agreement.

## Activation prerequisites

Get a publisher account, approved roofing service codes, approved source ID, staging/production tag IDs, exact consent text and version, confirmation that static consent is accepted (or the dynamic-consent specification), any Jornaya requirement, the TrustedForm SDK snippet, coverage/traffic rules, payout/rejection terms, and production sign-off. Configure and test locally before deploying. Credentials alone are not evidence of consent approval or live-delivery approval.

## What is wired

- Default `VITE_LEAD_DELIVERY=modernize`; explicit `manual` preserves the earlier separate lead workflow. Contractor software and its data are untouched.
- `modernizeGateway/config` returns a safe public projection of runtime settings. No tagId is returned. Missing or invalid configuration shows the closed preview and does not load TrustedForm or accept submissions.
- `modernizeGateway/submit` checks origin, method, size, bot verification, fields, configuration/consent version, and ZIP/state consistency when the location service is available. ZIP lookup is not address validation; Modernize performs its own acceptance checks. An outage does not fabricate a successful location check.
- Approved material -> exact roofing service; explicit plan/timeframe -> exact documented values. Unsupported material/inspection-only needs do not advance. The current API flow is residential; confirm your account's supported property types before advertising.
- Names are collected separately; phone is required. Google autocomplete remains optional. Full-address entry populates the property step.
- A single persistent form is tagged for TrustedForm and receives the SDK certificate through `xxTrustedFormCertUrl`. Consent is unchecked and the account-provided text is rendered as plain text adjacent to the final button. No synthetic token is used outside isolated test fixtures. The certificate URL is format-checked by RoofZeus and sent to Modernize; RoofZeus does not independently claim that the certificate is authentic or retained. Modernize must validate it and confirm retention responsibilities.
- Modernize receives no name, phone, email, or street address in Ping. Post runs only for a valid acceptable offer. The offered price is private and is not proof of final payable revenue.
- Request IDs, same-project duplicates, certificate reuse, and rate limits are checked transactionally. Public outcomes include reference/status/environment only. Requests are stored in the private `roofzeus-leads` database, not the contractor database.
- A lost HTTP response can be checked with the original payload; the form locks those details until resolved. A confirmed rejection, unconfirmed delivery, and accepted lead have distinct messages. Never display a contractor match just because Ping succeeded.
- Staging is restricted to `localhost` / `127.0.0.1` browser origins; production domains cannot submit staging leads. No real partner requests were made during implementation.

## Credentials and settings to obtain

| Where | Needed | Where it goes |
| --- | --- | --- |
| Modernize account manager | Approved publisher account and roofing service codes; production tagId; agreed sourceId | `MODERNIZE_SETTINGS` server secret |
| Modernize account manager | Exact plain-text consent, version, static consent approval, whether Jornaya/dynamic advertiser selection is required | Same server secret; dynamic/Jornaya-dependent accounts remain disabled pending their specification |
| Modernize account manager | Written production sign-off after staging; coverage, traffic rules, payment and rejection terms | Approval flags only after sign-off; optional ZIP restriction and minimum bid |
| ActiveProspect TrustedForm Certify | Account-provided script URL/snippet and certificate review | `trustedFormScriptUrl` in the server settings, then safely exposed to the browser. Never put a private TrustedForm API key in the snippet |
| Cloudflare Turnstile | Site key, secret, approved domains | `VITE_TURNSTILE_SITE_KEY`; Firebase `TURNSTILE_SECRET_KEY` |
| RoofZeus configuration | Generate a stable random secret of at least 32 characters for receipt and duplicate hashes | Firebase `MODERNIZE_RECEIPT_SECRET`; never a VITE variable. Keep stable independently of Turnstile key rotation |
| Google Maps (optional) | Browser-restricted Maps JavaScript / Places access | `VITE_GOOGLE_MAPS_API_KEY` |
| Firebase / Google Cloud | Existing project, named Firestore database, enabled billing/IAM | Deploy `modernizeGateway` only; retain app settings |
| Modernize, hosted option | Exact affiliate link and expected hostname | `affiliateUrl`, `affiliateHostname`; no direct lead API or TrustedForm integration required in hosted mode |

The public API documents staging tagId `204670250`. It is not a production credential. Obtain account authorization before doing live staging tests. The example configuration deliberately contains no tagId or consent text.

## Configure without committing credentials

1. Copy `functions/modernize-settings.example.json` to a private `modernize-settings.local.json` outside the deployed functions folder. This filename is gitignored. Do not put credentials into the example file or any VITE setting.
2. Populate only the approved values. `environment` is `disabled`, `staging`, or `production`. `accountApproved` is required for either active environment; `productionApproved` is additionally required for production. Keep both false until those approvals exist.
3. API mode requires `consentApproved` and `staticConsentApproved`, nonempty exact consent text/version, `jornayaRequired=false` only after confirmation, and `approvedServices` containing the exact enabled service codes. Do not turn off a required compliance mechanism merely to pass readiness.
4. Use the script URL from your TrustedForm account. Configure `field=xxTrustedFormCertUrl`, `use_tagged_consent=true`, and `sandbox=true` in staging or `sandbox=false` in production, preserving any other account parameters. Only HTTPS `api.trustedform.com/trustedform.js` is accepted. Our implementation refuses to load arbitrary script hosts.
5. `allowedZips: []` applies no additional local ZIP filter; it does not establish nationwide coverage. Set specific five-digit ZIPs to restrict a pilot. `minimumPrice` is the minimum Ping offer you agree to accept; zero accepts zero-dollar offers, so set your actual commercial threshold before launch. Nothing guarantees an offer or payout.
6. Run `npm run build --prefix functions`, then `node operations/modernize.mjs check-config <path-to-private-settings-file>`. This reports missing settings without printing their values. Exit 2 means configuration is incomplete; passing is not Modernize approval.

From an authenticated terminal in the repository, after choosing the intended Firebase project:

```powershell
firebase functions:secrets:set MODERNIZE_SETTINGS --data-file C:\secure\modernize-settings.local.json --project YOUR_PROJECT_ID
firebase functions:secrets:set TURNSTILE_SECRET_KEY --project YOUR_PROJECT_ID
firebase functions:secrets:set MODERNIZE_RECEIPT_SECRET --project YOUR_PROJECT_ID
npm run build --prefix functions
firebase deploy --only functions:modernizeGateway --project YOUR_PROJECT_ID
```

Create the named `roofzeus-leads` Firestore database if it does not already exist and deploy its deny-all client rules following LAUNCH.md. Enable TTL on `expiresAt` for the new collection groups `modernizeRequests`, `modernizeReceipts`, `modernizeCertificates`, `modernizeDuplicates`, and `modernizeRateLimits`. Records/receipts/certificate hashes currently expire after 90 days; short-lived rate/duplicate records after two days. TTL is not immediate. Review retention with the account manager and privacy operator before launch; legal holds and audit retention require an explicit operational policy. Do not delete a request without coordinating its receipts and partner withdrawal/deletion obligations.

On the Vercel frontend, set and rebuild:

```dotenv
VITE_LEAD_DELIVERY=modernize
VITE_MODERNIZE_GATEWAY_URL=https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/modernizeGateway
VITE_TURNSTILE_SITE_KEY=YOUR_PUBLIC_SITE_KEY
VITE_GOOGLE_MAPS_API_KEY=OPTIONAL_BROWSER_RESTRICTED_KEY
```

`VITE_PUBLIC_INTAKE_URL` is separate and still serves contractor interest or explicit manual mode. It cannot enable Modernize delivery. Leave `PUBLIC_INTAKE_ENABLED=false` unless that separate service is intentionally open. Ensure `PUBLIC_ALLOWED_ORIGINS` contains only your actual frontend origins; temporarily add `http://127.0.0.1:5175` for approved local staging. Do not expose a production-ready configuration to a public demo environment.

For hosted mode, set `mode=hosted`, approved environment/account flags, `affiliateUrl`, and the exact `affiliateHostname`. It redirects through an explicit user-clicked link with no added query parameters or referrer. Confirm conversion attribution with Modernize, since it depends on their supplied tracking link. The page explains the handoff; it does not claim a submitted or accepted lead.

## Verification before activation

### Roofing qualification and conditional questions

The on-site API form offers only repair, complete replacement, and new construction. Inspection-only, unspecified scope, and unknown/other material values are not submission options. Modernize's published Ping/Post contract lists the same three `RoofingPlan` values for all seven roofing service codes; it does not define an inspection or unknown-material value. General marketing references to inspections are not an API mapping. Confirm any expanded scope with the account manager before adding it.

Project type reveals the material question. Repairs ask for the current roof covering; replacement and new construction ask for the requested installation material. A material preference is not a final roofing specification. Confirm these field semantics with Modernize during account acceptance testing. Material options come from the public configuration's approved service list (the unconfigured, non-submitting preview uses all documented materials). Timing appears only after a supported material is selected. The documented `Don't know` timeframe remains valid. Project changes clear the material and timeframe; material changes clear the timeframe. Back navigation preserves otherwise unchanged answers.

Homeowners who cannot identify or choose a material can read inline guidance without submitting an invented value. Contact fields are reached only after valid project answers. Browser validation supplements the server's exact plan/material/timeframe checks, approved-service restrictions, property authorization, certificate, consent, coverage, and delivery gates. Passing these checks is eligibility to attempt delivery, not a promise of acceptance or payment: only Modernize's successful Post response confirms acceptance.

Regression coverage exercises all 21 documented plan/material combinations in the browser and server mapper, conditional field visibility, empty and restricted service lists, reset/back behavior, and rejection of forged inspection/unknown/other values.

### Contact input and preview behavior

Phone entry formats national numbers as `(210) 555-0123`, accepts pasted +1 formats, preserves the caret during edits, and rejects letters, extensions, foreign country codes, and excess digits. The submission payload uses ten digits. Both browser and server use `functions/src/contact-validation.ts` to enforce phone structure and email syntax. Email normalization trims outer whitespace and lowercases the value; valid plus tags and common local-part punctuation remain intact. Malformed local parts, missing domain suffixes, empty/invalid domain labels, and excessive lengths are rejected. These checks do not verify a working inbox, line ownership, or reachability; any additional verification service must be separately configured and approved.

When delivery is disabled, all steps identify the flow as a preview. The final `Check my details` button runs format validation and explicitly confirms that nothing was submitted; it never calls the gateway or creates a receipt. When API delivery is enabled, the final button requires bot and certificate verification, with an explanation when these are pending or failed. Native and shared contact validation plus the required consent still apply when clicking an enabled button. An enabled control alone is never evidence of partner acceptance.

The server validator changed alongside the browser. Deploy the updated `modernizeGateway` function as part of the configured backend activation process above; a Vercel redeploy updates only the frontend. Do not enable live delivery merely to test the preview button.

Local checks:

```powershell
npm test --prefix functions
npm run test:modernize
npm run test:e2e
npm run build
npm run test:public
```

All partner, certificate, bot, and geographic services in browser/unit tests use synthetic fixtures. These tests cannot prove that your real tagId is authorized, that a real certificate is acceptable, or that the partner pays for a submission.

After approval, use the real staging environment with synthetic contact details supplied/agreed with the account manager. Confirm exact payloads, accepted and rejected examples, service coverage, real certificate recording, visible consent/advertiser requirements, duplicate behavior, and account reporting. A real certificate must capture the entire intended journey, including prefilled fields and SPA steps; have the account manager review this implementation specifically. Then replace staging values, remove sandbox mode, obtain sign-off, and enable production. Confirm the first real lead in their publisher reporting before buying traffic.

## Private delivery review

Set `GOOGLE_CLOUD_PROJECT` and authenticate with Application Default Credentials for a restricted operator account. The same private named database is used. No browser user can access it through Firestore client SDKs.

- `node operations/modernize.mjs list`: recent references, statuses, phase, environment, partner IDs; no homeowner contact details.
- `unknown` or `processing` older than a minute: do not resend. Ask Modernize to check `lead.publisherSubId` (our requestId), the environment, timestamps, and any partner leadId stored privately. Use their approved support channel; don't put PII in GitHub or logs.
- After confirmed resolution, create a private `modernize-evidence.local.json` containing `status` (`accepted` or `no_match`), `operator`, `evidence` (support ticket/reference, no PII), and `partnerLeadId` for accepted requests. Run `node operations/modernize.mjs reconcile RZM-REFERENCE <evidence-file>`. This updates the receipt outcome and creates a private audit entry. It never calls Modernize or resends a lead and refuses already-final outcomes or in-flight requests younger than two minutes.
- Monitor Modernize publisher reporting for final payable amounts, returns, and payment reconciliation. The Ping price in our database is only an offer. No Stripe integration is needed for network payouts.
- Original receipts remain retrievable with the exact original submission even after new intake is disabled or consent settings change. The receipt hash uses `MODERNIZE_RECEIPT_SECRET`, separate from Turnstile. Rotating the receipt secret requires a deliberate migration/retention plan; do not casually rotate it while receipts are in use.
- Make `privacy@roofzeus.com` a working, monitored mailbox before enabling intake. Verify a withdrawal requester, record the request privately, and relay any already-shared request to Modernize through the agreed withdrawal channel. This code does not pretend that previously delivered contact details can be recalled automatically. Existing manual records remain under their old consent.
- Keep form previews off until their correct environment/settings are available; never use public query parameters as a live-mode switch. Browser analytics contain only generic event names, not addresses, contact fields, URLs, or partner credentials.

## Remaining external decisions

Approval, payout terms, the final consent/advertiser contract, TrustedForm account configuration and verification, real staging tests, production acceptance, and domain/mailbox configuration remain external prerequisites. If the account requires dynamic advertiser selection or Jornaya, request its current technical specification; the readiness gate stays closed until that additional account-specific work is implemented. There is no claim that setting a tagId alone makes this production-compliant.

## Implementation verification, September 12, 2026

- 42 backend tests passed, including the real Firestore store adapter exercised against a transaction fixture, concurrent retries, consent changes, shutdown, and separate Turnstile key rotation.
- 5 Modernize browser tests passed, including consent/certificate capture, unknown delivery, disabled/missing-certificate behavior, hosted handoff, unsupported answers, and responsive layouts.
- 8 existing public/manual/contractor browser tests passed.
- 5 production/static checks passed; frontend production/SSR and functions builds passed. Targeted public-site ESLint passed.
- Desktop and mobile production previews visually inspected; no browser errors; submission remains disabled with absent settings.
- No live Modernize request, certificate issuance, Firebase deployment, account registration, email, or payment was performed. Real staging and production acceptance remain pending the external prerequisites above.

## Demo review route and mode transitions

`/demo` is a public, noindex review route built from the same LandingPage, LocationStart and ModernizeFunnel components. It overrides runtime configuration with a closed API configuration even when the homepage is live or hosted. It does not fetch gateway configuration, send a lead, load TrustedForm/Turnstile/Google search, perform ZIP lookup, or emit estimate-start analytics. ZIP entry does not read/write localStorage; entered details are held in component state, not URL parameters. Completion validates fields, clears the funnel contact fields and shows an explicit demo confirmation with a restart action. No consent evidence, partner acceptance or receipt is fabricated. Ordinary hosting/asset requests still occur. The public homepage's existing disabled, staging and production gates are unchanged.

Use `/demo` for application review now, local `/` connected to an authorized staging gateway for technical tests, and the public `/` with production configuration only after sign-off. There is no hosted staging route or deployment in this change. The server currently allows staging only from localhost/127.0.0.1 plus the exact configured origin. A remotely accessible staging site would require explicit origin support, environment isolation and appropriate access controls; do not point a public demo at production to bypass that restriction.

The public specification currently describes Jornaya as optional and TrustedForm as required. Confirm any account-specific variation. The staging tag is published test configuration, not a credential that confers authorization. Our `mode` field chooses API versus hosted handoff; `environment` controls disabled/staging/production. Demo is a fixed route behavior, not a fourth backend environment. Our origin limits, bot verification and receipt secret are RoofZeus implementation safeguards, not additional requirements attributed to Modernize.

See `docs/RoofZeus-Demo-Staging-Live-Guide.pdf` for the operator guide, setting locations, PowerShell deployment sequence, account-manager questions and activation/rollback procedures. The guide records current limits and does not claim Modernize certification. Review the current account contract before activation.
