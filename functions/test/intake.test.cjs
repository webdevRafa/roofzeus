const test = require("node:test");
const assert = require("node:assert/strict");
const { validateIntake, CONSENT_VERSION } = require("../lib/intake-model");
const base = {
  kind: "homeowner",
  requestId: "00000000-0000-4000-8000-000000000001",
  name: "Test Homeowner",
  email: "TEST@example.com",
  phone: "",
  notes: "",
  consent: true,
  consentVersion: CONSENT_VERSION,
  address: "123 Example Lane",
  city: "San Antonio",
  state: "TX",
  zip: "78209",
  service: "roof-repair",
  urgency: "Within a month",
  propertyType: "Single-family home",
  roofMaterial: "Not sure",
  authorized: true,
  contactMethod: "email",
};
test("Normalizes contact data and discards injected routing/approval fields", () => {
  const result = validateIntake({
    ...base,
    status: "sold",
    assignedContractorId: "attacker",
    consentText: "wrong",
  });
  assert.equal(result.email, "test@example.com");
  assert.equal(result.status, undefined);
  assert.equal(result.assignedContractorId, undefined);
  assert.ok(result.consentText.includes("until I agree"));
});
for (const [name, patch] of Object.entries({
  missingConsent: { consent: false },
  staleConsent: { consentVersion: "old" },
  badZip: { zip: "7820" },
  badState: { state: "ZZ" },
  badService: { service: "injected" },
  badUrgency: { urgency: "any" },
  noAuthority: { authorized: false },
  phoneRequired: { contactMethod: "phone" },
  invalidPhone: { phone: "1234567890" },
  invalidEmail: { email: "not-email" },
  honeypot: { website: "spam" },
  oversizedNotes: { notes: "x".repeat(2001) },
  invalidId: { requestId: "x".repeat(36) },
  objectName: { name: { evil: true } },
})) {
  test(`Rejects ${name}`, () =>
    assert.throws(() => validateIntake({ ...base, ...patch })));
}
test("Accepts formatted U.S. phone and leading-zero ZIP without numeric conversion", () => {
  const result = validateIntake({
    ...base,
    phone: "+1 (210) 555-0123",
    zip: "02108",
    state: "MA",
    city: "Boston",
  });
  assert.equal(result.phone, "12105550123");
  assert.equal(result.zip, "02108");
});
test("Contractor territories are deduplicated and bounded", () => {
  const partner = {
    ...base,
    kind: "contractor",
    businessName: "Example Roofing",
    phone: "2105550123",
    territoryZips: "78209, 78209, 78201",
  };
  assert.deepEqual(validateIntake(partner).territoryZips, ["78209", "78201"]);
  assert.throws(() => validateIntake({ ...partner, territoryZips: "7820A" }));
  assert.throws(() =>
    validateIntake({
      ...partner,
      territoryZips: Array.from({ length: 31 }, (_, i) =>
        String(78000 + i),
      ).join(","),
    }),
  );
});
module.exports = { base };
