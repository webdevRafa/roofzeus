# RoofZeus / Modernize implementation plan

Status: implementation in progress; no publisher approval or credentials supplied. Live delivery must remain disabled. This integration is based on public documentation, not a certification or endorsement by Modernize.

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
