# RoofZeus homeowner launch

The public website now serves homeowners. The existing contractor workspace remains on `app.roofzeus.com`; `signup.roofzeus.com` opens its signup flow. The approved white-eyed Zeus identity is retained.

## What is ready

- Responsive homeowner homepage, service pages, three practical guides, FAQs, privacy/terms, coverage page, and San Antonio pilot resource page.
- Four-step project intake: project, property, contact, explicit consent and review. Manual address entry works without Google. ZIP lookup suggests city/state, and the homeowner can correct them.
- New Google Places autocomplete integration, loaded only during the address step.
- Real server-side lead intake for Firebase, with Cloudflare Turnstile verification, origin allowlist, validation, rate limits, idempotent retries, and same-project daily deduplication.
- Private homeowner and contractor-interest queues in a **separate Firestore database named `roofzeus-leads`**. No contractor account or browser client can read this database.
- Operator commands for queue review and recording a named-contractor introduction permission. Nothing automatically sells or broadcasts a lead.
- 19 prerendered public HTML pages. Fourteen approved core pages enter the sitemap. The San Antonio page is deliberately `noindex` until a real participating contractor and local editorial review are in place. Forms, legal pages, and the 404 page are excluded too.
- Contractor app code is loaded separately from the public bundle. Existing dashboard routes and business workflows are preserved.

The code is ready for configuration. **The new intake backend has not been deployed, and no production API keys were supplied.** The public form shows an opening-soon state until its endpoint and Turnstile site key exist. It never displays a successful request without a server receipt. Google suggestions have been tested with an API fixture; a real restricted key is still needed to test Google's production service.

## Keys and services

| Service                   | Values                                                                         | Where to get them                                                                                                                                                                                     | Required?                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Google Maps Platform      | `VITE_GOOGLE_MAPS_API_KEY`                                                     | [Google Cloud credentials](https://console.cloud.google.com/apis/credentials): create a browser API key; enable **Maps JavaScript API** and **Places API (New)** in the same billing-enabled project. | For address suggestions. Manual entry remains available without it.                                                               |
| Cloudflare Turnstile      | `VITE_TURNSTILE_SITE_KEY`, server secret `TURNSTILE_SECRET_KEY`                | [Cloudflare dashboard](https://dash.cloudflare.com/) → Turnstile → Add widget. Add `roofzeus.com` and `www.roofzeus.com` as allowed hostnames.                                                        | Required for live submissions.                                                                                                    |
| Existing Firebase project | Existing `VITE_FIREBASE_*` values, deployment access, named Firestore database | [Firebase console](https://console.firebase.google.com/), existing RoofZeus project. Retain existing app settings. The public form does not need a Firebase browser API key.                          | Required backend infrastructure.                                                                                                  |
| Intake function           | `VITE_PUBLIC_INTAKE_URL`                                                       | Copy the exact HTTPS URL printed after deploying `submitPublicIntake`.                                                                                                                                | Required; this is a URL, not a secret.                                                                                            |
| ZIP lookup                | No key                                                                         | [Zippopotam.us](https://www.zippopotam.us/)                                                                                                                                                           | Already integrated, with manual fallback. Suggestions do not establish service coverage or validate a deliverable street address. |

Restrict the Google browser key to your two website origins and to Maps JavaScript API / Places API (New). Use separate development keys with localhost restrictions. Do not put a secret key in any `VITE_*` variable: Vite values are public. [Google key security guidance](https://developers.google.com/maps/api-security-best-practices).

Turnstile is checked on the server, including its success result, action, and exact hostname. A browser widget alone is insufficient. [Cloudflare validation documentation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

No provider-directory, paid geolocation, weather, SMS, payment, or AI API is needed for this launch. Email notifications are not enabled in this version; operate the private queue below. The existing contractor app's Resend integration is untouched.

## Deployment order

1. Confirm the intended Firebase project and Vercel project. Keep all existing contractor app environment values. Create a monitored `privacy@roofzeus.com` inbox or alias; it is linked in the new privacy/terms pages. Have the business owner review the contact/sharing copy and establish a daily queue-review routine before accepting requests.
2. In the same Firebase project, create a **named Firestore Native database** with ID `roofzeus-leads` in a suitable U.S. location such as `nam5`. Do not reuse or replace the contractor app's `(default)` database. Use the Google Cloud CLI, for example:

   ```powershell
   gcloud firestore databases create --database=roofzeus-leads --location=nam5 --type=firestore-native --project=YOUR_PROJECT_ID
   ```

   Enable billing for the Cloud Functions deployment. Confirm that the function runtime service account has the necessary database access and that operator access is restricted to your own authorized staff. [Named database documentation](https://firebase.google.com/docs/firestore/manage-databases).

3. Deploy the isolated deny-all client rules. `firebase.json` targets only `roofzeus-leads`; it does not deploy new rules to the existing contractor database:

   ```powershell
   firebase deploy --only firestore:roofzeus-leads --project YOUR_PROJECT_ID
   ```

4. Create the production Turnstile widget. Store its secret using:

   ```powershell
   firebase functions:secrets:set TURNSTILE_SECRET_KEY --project YOUR_PROJECT_ID
   ```

5. Copy `functions/.env.example` to `functions/.env.YOUR_PROJECT_ID`. Set the exact public origins in `PUBLIC_ALLOWED_ORIGINS`. After the database, inbox, rules, and operational process are ready, set `PUBLIC_INTAKE_ENABLED=true`. Never allow wildcard preview origins. For a controlled preview, add only its exact origin and add its hostname to a separate test Turnstile widget.
6. Install/build functions and deploy **only the new intake function**, leaving the contractor functions alone:

   ```powershell
   npm ci --prefix functions
   npm run build --prefix functions
   firebase deploy --only functions:submitPublicIntake --project YOUR_PROJECT_ID
   ```

7. Set `VITE_PUBLIC_INTAKE_URL`, `VITE_TURNSTILE_SITE_KEY`, and optionally `VITE_GOOGLE_MAPS_API_KEY` in the Vercel project's production environment. Rebuild/redeploy. These are build-time settings. Keep the current app's Firebase variables.
8. In Vercel, attach `roofzeus.com`, `www.roofzeus.com`, `app.roofzeus.com`, and `signup.roofzeus.com` to the intended project. Use `roofzeus.com` as the primary public domain and configure `www` to redirect to it. If the app currently uses a separate Vercel project, keep its environment variables and domain assignment there and deploy this revision there too. `vercel.json` preserves host-based app routing and serves generated public pages directly. Unrecognized public paths serve the real custom 404.
9. Enable TTL on the `expiresAt` field for the `rateLimits`, `duplicates`, and `receipts` collection groups in the **named** database. These short-lived security/receipt records should be removed automatically. Lead and partner records intentionally remain until reviewed or deleted by an operator; establish and implement a retention schedule suitable for your business before launch. [Firestore TTL setup](https://firebase.google.com/docs/firestore/ttl).
10. Submit a synthetic test request on the deployed site, inspect its private record, retry the same request to confirm deduplication, test the Google address picker with the real key, and confirm that the contractor login and a signed-in app deep link still work. Delete the synthetic records when finished. Live Firebase/Google/Turnstile integration must be checked after real configuration; local tests use isolated fixtures.

The frontend deployment follows the repository's existing GitHub/Vercel integration. A Git push does **not** deploy Firebase Functions or create the named database.

## Run your first leads manually

Use [Google Cloud Firestore](https://console.cloud.google.com/firestore/databases) and select `roofzeus-leads`, or use the private CLI with Application Default Credentials:

```powershell
gcloud auth application-default login
$env:GOOGLE_CLOUD_PROJECT='YOUR_PROJECT_ID'
node operations/leads.mjs list
node operations/leads.mjs partners
node operations/leads.mjs show RZ_REFERENCE_FROM_QUEUE
```

`list` prints only operational fields, not homeowner names, addresses, or contact information. `show` intentionally reveals one record to the authenticated operator. Never put operator credentials into the browser, a public deployment, or GitHub. Grant operator IAM access narrowly.

Review `requests` daily. New records have `status: new`, `sharingStatus: not_shared`, and no assigned contractor. Check the location and project details; `geoValidation: manual_review_required` means lookup could not establish a ZIP/state match. A ZIP/state match is not street-address validation. Mark the record `reviewing`, follow up by the requested contact method, and close it honestly if there is no suitable contractor. For withdrawals, immediately set `status: withdrawn` and stop contact/sharing; handle the associated deletion request in the named database and any operator-held records.

For your San Antonio friend, first obtain a contractor interest application and complete a business/coverage review. In `contractorApplications`, set `status: approved` only after agreeing on real participation and documenting your checks. Do not represent a pending application as a vetted contractor.

The homeowner's initial consent is **to RoofZeus contact only**. It does not authorize a sale or transfer to an unnamed contractor. Before sharing, identify the specific company, explain the introduction, and record the homeowner's explicit agreement. Then create a private, untracked JSON file:

```json
{
  "contractorId": "RZ-REPLACE_WITH_APPLICATION_REFERENCE",
  "contractorName": "Exact approved business name",
  "consentAt": "2026-09-12T18:00:00Z",
  "consentEvidence": "Internal reference to the actual homeowner reply or recorded permission",
  "operator": "Your operator identity"
}
```

```powershell
node operations/leads.mjs record-introduction RZ_REFERENCE_FROM_QUEUE path/to/approval.json
```

This command checks approval, exact business name, territory ZIP, and request status before recording permission and an audit event. It does **not** email, text, sell, or send the lead. Coordinate the agreed introduction privately. Recheck withdrawals immediately before any actual sharing. This gives you a manageable launch with one contractor before building automated distribution, billing, or a marketplace.

## PSEO foundation and expansion

Page metadata and content are in `src/public-site/content.ts`; the build produces readable HTML, canonical tags, structured data, and a sitemap. The visitor sees the same initial HTML as a crawler. Remembered ZIP information updates client-side after load and never forces a geographic redirect. [Google's rendering guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).

Only the San Antonio pilot location exists. There are no mass-generated city or ZIP pages, fake ratings, provider counts, storm alerts, or roof-price promises. The city page links directly to [San Antonio Development Services](https://www.sa.gov/Directory/Departments/DSD) and [NWS Austin/San Antonio](https://www.weather.gov/ewx/). It does not invent current permit rules or weather events.

Before enabling indexing on a new local page: confirm city/state geography, an actual participating contractor and supported ZIPs, meaningful original local content, current primary sources, a working lead flow, and an editorial review. Only then change its metadata `index` flag and rebuild. Submit `/sitemap.xml` in [Google Search Console](https://search.google.com/search-console/). Expand by real demand and contractor supply, not by the number of URLs that can be generated. [Google spam policies](https://developers.google.com/search/docs/essentials/spam-policies).

## Development and verification

```powershell
npm ci
npm ci --prefix functions
npm run dev
npm run build
npm run test:public
npm test --prefix functions
npx playwright install chromium
npm run test:e2e
```

The browser suite starts an isolated dev server on port 5174, uses synthetic data and mocked Google/Turnstile/intake responses, and does not send homeowner information to a real backend. It covers request success/retry, manual address fallback, invalid fields, contractor interest, navigation, contractor app login, and public routes at 1440/768/390/320 pixels. Backend tests execute the intake handler with isolated persistence and network adapters; a real Firestore deployment test remains a launch step.

The initial public bundle is approximately 91 KB gzipped before network compression differences; the larger existing contractor bundle is loaded only on contractor hosts. Build warnings about that existing app bundle do not affect the homeowner entry point.

## Intentional first-version boundaries

- No auto-distribution or paid lead transactions; operator review and named-partner permission come first.
- No live provider directory, roof pricing estimator, storm alerts, device GPS, or inferred coverage claims.
- No photo uploads yet; the core request can be collected without the added storage and moderation burden.
- No automated email/SMS campaign. Follow up manually through your existing business channels and the homeowner's chosen method.
- Minimal analytics hooks (`roofzeus:analytics`) include event names, steps, and service categories only. No third-party tracker is installed and no personal information is sent to analytics.
- Real key configuration, monitored contact inbox, live backend deployment, operator access, and production integration verification remain required before opening intake.

## Image provenance

The house photograph is an original AI-generated illustration, not a claimed completed contractor project. It was generated using the built-in imagegen tool and optimized into `public/images/roof-home.webp` and `roof-home-small.webp`. The source prompt is in `docs/IMAGE-PROMPT.md`. The approved RoofZeus logo and favicon were preserved.
