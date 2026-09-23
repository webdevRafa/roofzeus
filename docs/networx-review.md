# Networx partner review preparation

## Shareable material

- General page: https://roofzeus.com/
- Replacement: https://roofzeus.com/roof-replacement
- Repair: https://roofzeus.com/roof-repair
- Review page and creative downloads: https://roofzeus.com/partner-preview
- Sample walkthroughs: append `?preview=1` to any landing page.

The review page is public but excluded from indexing, not access-controlled. The two new campaign pages are also noindex during pre-launch. Their metadata and HTML are prerendered. The existing homepage indexing policy remains unchanged. Remove the campaign noindex flags deliberately when launching, rather than manufacturing city pages.

## What changed

Shared campaign content supplies distinct images, headlines, FAQs, estimate checklists, and editable repair/replacement form defaults. Existing consent, server configuration, recording, validation, and duplicate-delivery controls remain in place. Home copy and educational sections now match the two dedicated pages. The approved v8 brand artwork is unchanged.

All real landing pages share approximate visitor-area lookup. A valid entered property ZIP takes priority; editing an incomplete ZIP or a failed lookup shows generic wording instead of the old city. No location is used to claim storm damage, confirm coverage, or promise contractor availability. A separate storm campaign is deferred until buyer rules and actual geographic targeting are known. The repair FAQ addresses storm-related concerns without insurance or emergency-service promises.

The 9 PNG ads are three concepts in three proportions, with editable SVG sources. They are proposed creative samples, not claims of past traffic or results. See public/creatives/README.md for copy and destination URLs.

## Attribution and analytics

Allowed fields: landingPath, server-derived variant, utm_source, utm_medium, utm_campaign, utm_content, creative_id. Campaign values must be alphabetic-starting identifiers of at most 64 characters using letters, digits, hyphens and underscores; long numeric sequences are rejected. Never use names, contact details, or property addresses in these codes. Arbitrary query parameters, raw referrers and click IDs are not retained.

Attribution stays in memory through the form and is frozen with the original submission on retry. It is not saved in browser storage. A fresh document loses the prior in-memory campaign context. The server sanitizes again before internal lead storage; it does not add unknown fields to a buyer API payload. Deploy the updated Firebase gateway before relying on server-side attribution retention; a GitHub/Vercel frontend deployment does not deploy Firebase functions.

Vercel analytics receives query/hash-free page URLs and allowlisted form events with page and step only. Demo and reviewer events are excluded. The analytics component is not mounted on a fresh sample or partner-preview page. Existing analytics scripts can remain after client navigation from a normal page, but beforeSend and event filtering still exclude sample/reviewer activity. Custom-event availability and reporting depend on the Vercel account configuration; this work does not establish a verified conversion dashboard.

## Still required before accepting leads

Networx approval is pending. No Networx transport or consent language has been invented. Keep delivery closed until Networx provides its publisher API or hosted-form instructions, test credentials, approved consent and recipient wording, certificate requirements, accepted project types/materials, buying ZIPs, traffic-source rules, and acceptance/rejection semantics. Confirm duplicate/return rules and payout terms directly; contractor-facing credit policies are not a publisher contract.

Adapt the existing server-side transport to the supplied specification, test acceptance/rejection/timeouts without real consumer data, confirm idempotency and internal attribution, and review the final form and recording together. Then explicitly enable the agreed buyer configuration. No support email or partner email was sent by this implementation.

## Research and image provenance

Reviewed Networx's [affiliate program](https://affiliates.networx.com/) and GAF's [homeowner roof-repair guidance](https://www.gaf.com/en-us/plan-design/homeowner-education/roof-damage/roof-repair). Copy uses general project observations and questions to ask a roofer, with no borrowed testimonials, price guarantees, insurance eligibility claims, or fixed roof-life promises.

Two original AI-generated photographic illustrations were created for this work and exported as optimized WebP assets. Replacement brief: realistic American suburban home with a prominent charcoal asphalt-shingle roof, warm natural daylight, no people, signs, text, logos, or storm destruction. Repair brief: realistic close view of asphalt shingles, chimney and flashing on a residential roof, natural daylight, no people, text, logos, staged emergency or before/after claim. The general campaign reuses the site's existing roof-home image. The approved brand mark is composed from the existing vector asset, not regenerated.

Generated sources: exec-3dcb28f9-f2cd-44bd-8047-4c14aff38bb3.png (replacement), exec-0f7b9489-3a00-4801-a11d-a11c3e847b2c.png (repair). Production exports: public/images/roof-replacement.webp and roof-repair.webp. All imagery is illustrative; it does not depict RoofZeus construction work.

## Validation

- Production TypeScript, client build, SSR, and prerender completed.
- 35 browser checks passed, including campaign defaults, editable project choice, sample isolation, ZIP precedence, downloads, 320px overflow, attribution through submission, exact consent, and duplicate-request safeguards.
- 54 backend tests passed, including attribution filtering and legacy submissions.
- 6 public-build checks passed, including metadata, sitemap, private-data rules, and production exclusion of the local certificate-test page.
- Changed frontend files passed targeted ESLint checks. Desktop and mobile layouts and exported ad images were visually inspected.

These are local/mocked verification results, not a live Networx delivery test or resolution of the pending TrustedForm certificate-viewer support inquiry.
