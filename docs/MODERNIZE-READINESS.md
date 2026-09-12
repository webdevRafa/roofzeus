# Modernize readiness audit — September 12, 2026

**The published required data fields are implemented. Account acceptance and production activation are not yet verified.** This is a code and public-contract audit, not Modernize certification. No real lead was transmitted during this audit.

## Data captured and sent

The mapping below was checked against [Modernize's public Ping/Post specification](https://apidoc.modernize.com/publishers/ping-post.html), which is labeled a draft. Obtain the current account specification before activation.

| Data | RoofZeus behavior |
| --- | --- |
| Roofing service | Explicit material choice maps to one of seven documented roofing service codes; active configuration limits choices to authorized services. |
| RoofingPlan | Repair, complete replacement, or new construction; no invented mapping for inspections or unknown materials. |
| postalCode | Five digits; full property address required later even when starting with ZIP only. |
| buyTimeframe | Immediately, 1–6 months, or the documented unknown timing value. |
| ownHome | Yes only after the user affirms ownership or authorization to arrange work. |
| firstName, lastName | Separate required fields with length and blank-value checks. |
| address, city, state | Required property information; address and city validated after trimming; supported US state code. |
| phone, email | Shared frontend/server syntax checks; formatted phone becomes ten digits in delivery. This does not establish reachability or ownership. |
| tagId, partnerSourceId | Account-approved server configuration. |
| publisherSubId | Unique request UUID; confirm this attribution convention with the account manager. |
| pingToken | Obtained from a successful Ping; not collected from the homeowner. |
| homePhoneConsentLanguage | Exact configured text shown with unchecked, required permission; server sends its own versioned copy. |
| trustedFormToken | Certificate URL issued by the configured SDK; never synthesized in a real submission. |

Contract tests check the complete Ping and Post field sets, all 21 documented roofing combinations, unsupported answers, consent/version checks, and normalization. Delivery requires a successful Post with a lead ID before showing acceptance. Coverage, duplicate, fraud, certificate, and commercial checks can still cause Modernize to reject a correctly formatted lead.

## Improvements from this audit

- Property inputs now reject whitespace-only and padded, too-short values before either address step can advance, including programmatically populated values.
- Added stable roofing radio IDs and TrustedForm contact tags for phone, email, and street address.
- Added precise advertiser tagging without changing any characters in the configured consent text.
- Added a configuration gate so an incomplete or old consent configuration cannot silently activate delivery.

[TrustedForm's consent-tag documentation](https://developers.activeprospect.com/pages/trustedform/consent-tagging) distinguishes an always-consented single advertiser from selectable advertisers. The former tag must name the actual advertiser receiving consent, not a generic network or unspecified partner list. Its automated verification features depend on correctly tagged consent. A real recorded certificate must still be reviewed by the recipient.

## Additional settings before staging or production

The updated `functions/modernize-settings.example.json` includes two new server settings inside `MODERNIZE_SETTINGS`:

- `consentAdvertiserName`: exact advertiser name occurring once in the approved consent text. No default company name is assumed.
- `singleAdvertiserConsentApproved`: set true **only if Modernize confirms that this specific flow grants consent to one fixed advertiser and accepts that arrangement**. Static text approval alone is insufficient.

Both settings apply to API staging and production; they do not enable `/demo` or change hosted handoff. The frontend receives the name as public consent metadata. Deploy the updated gateway together with the frontend before activating. Existing incomplete API settings intentionally remain closed.

If Modernize requires multiple/selectable advertisers, linked partner disclosures, or another consent mechanism, obtain that specification first. This implementation must be extended for that contract; do not substitute a network's name or mark the single-advertiser flag true to bypass the gate. The public specification says some services additionally require Jornaya. If required for this account, its integration remains necessary and the current gate stays closed.

These additional settings supersede the older setup examples in the PDF mode guide. The demo/staging/production separation and secret locations in that guide remain unchanged.

## What remains before live traffic

1. Modernize approval, current roofing field semantics, permitted traffic and geography, source/sub-ID conventions, authorized services and account tag IDs.
2. Approved exact consent, advertiser arrangement, and whether Jornaya is required.
3. Real TrustedForm account snippet and staging certificate review, including the entire SPA journey and carried-forward address values. Confirm certificate claiming and retention responsibilities.
4. Configure Firebase settings, Turnstile keys, receipt secret, named database and allowed origins using `MODERNIZE.md`.
5. Complete authorized staging tests with agreed synthetic data: accepted and rejected responses, actual certificate checks, duplicate handling, and reporting attribution.
6. Obtain production sign-off, switch to production tag/configuration and non-sandbox certificates, then verify the first real acceptance in publisher reporting.

For application review now, share `https://roofzeus.com/demo` and identify it as an isolated demonstration. It validates the form without sending or retaining a lead. The public homepage remains closed until its activation requirements are satisfied.

## Verification completed

48 backend tests, 17 Modernize browser tests, 9 shared public/contractor browser tests, and 5 production/static checks passed. Frontend/SSR and functions builds passed; targeted frontend lint passed. External services were mocked in these checks. No Firebase gateway deployment or real partner acceptance test was performed.

## Second audit and address integrity follow-up

The second pass reconfirmed the required fields and identified two reproducible verification lifecycle bugs. Before changing implementation, browser regressions demonstrated that a cleared certificate field left submission enabled, and that loss of a response followed by unavailable bot verification blocked receipt retrieval. The fixes clear stale certificate state, read the SDK field again at submission, and allow a locked request to retrieve its original receipt without a fresh token. The backend still requires verification for a request that was never recorded; retries do not create a second delivery from an existing receipt.

A street-only Google result was also accepted by the old length-only address check. The shared entry form, Modernize preview/demo/staging/live flow, manual flow, and both lead endpoints now require a house/building number and street name. Google selections without a street number focus the editable address field and show its validation prompt. Common suffix, hyphen, fraction, and grid-number formats are supported. This is a completeness check, not Google Address Validation, a postal certification, or a guarantee that the property exists. Unnumbered lots and other nonstandard addresses need a separate reviewed workflow; do not invent a number for them.

Verification after these fixes: 52 backend tests, 21 Modernize browser tests, and 10 shared public/contractor browser tests passed, including the before/after verification regressions and street-only Google selections. An additional immediate-submit certificate regression also passed. Frontend/SSR and functions builds, 5 production/static checks, and targeted frontend lint passed. Services remained mocked. Deploy the updated `modernizeGateway` and the separate `submitPublicIntake` function (if that manual flow is enabled) to apply server validation; a Vercel deployment alone updates only the website.

## Jornaya clarification

Jornaya creates a Universal LeadiD associated with a visitor's form interaction so recipients can check the lead's origin and related evidence. It is generated by the installed technology, not entered by the homeowner. See the [vendor's explanation of collection and LeadiD](https://infutor.com/consumer-privacy-policy-jornaya/) and [TCPA Guardian verification fields](https://activeprospect.com/leadconduit/integrations/jornaya/tcpa_guardian/). A token itself does not grant contact permission.

Modernize's specification requires TrustedForm and says some services additionally require Jornaya in the Post field `leadIDToken`. It does not establish whether RoofZeus's eventual roofing account requires it. Ask the account manager: “Do our authorized roofing services require Jornaya LeadiD in addition to TrustedForm? If yes, which campaign/script, test setup, disclosure tagging, and retention/verification arrangements should we use?”

No Jornaya token is currently generated or sent. If required, the script, real token capture, server mapping, and acceptance tests must be implemented against that specification. The existing gate intentionally prevents activation until Jornaya is confirmed unnecessary or its required integration is completed. The single-advertiser consent limitation, real certificate review, production authorization, and staging sign-off remain unresolved external dependencies.
