const test = require("node:test");
const assert = require("node:assert/strict");
const { isCompletePropertyAddress } = require("../lib/property-validation");
const { validateLead } = require("../lib/modernize-contract");
const { validateIntake, CONSENT_VERSION } = require("../lib/intake-model");
const { settings, lead } = require("./modernize-fixtures.cjs");
const base = {
  ...lead(),
  kind: "homeowner",
  name: "Synthetic Homeowner",
  consentVersion: CONSENT_VERSION,
  service: "roof-repair",
  urgency: "Within a month",
  propertyType: "Single-family home",
  roofMaterial: "Not sure",
  contactMethod: "email",
};

test("Property completeness accepts common numbered street address formats", () => {
  for (const address of [
    "123 Main Street",
    "123B Main Street",
    "12-34 Main Street",
    "123 1/2 Main Street",
    "N64W23876 Main Street",
    "100 Highway 90",
    "123 5th Avenue",
    "123 Main Street Apt 2",
    " 123 Calle San José ",
  ]) {
    assert.equal(isCompletePropertyAddress(address), true, address);
  }
});

test("Street-only, numbered streets, postal boxes and missing street names are incomplete", () => {
  for (const address of [
    "Morning Star Street",
    "5th Avenue",
    "Highway 90",
    "Morning Star Street Apt 2",
    "PO Box 123",
    "P.O. Box 123",
    "123 PO Box",
    "RR 2 Box 123",
    "12345",
    "123 1/2",
    "123 Main\u007fStreet",
  ]) {
    assert.equal(isCompletePropertyAddress(address), false, address);
  }
});

test("Both lead endpoints reject street-only requests even when browser validation is bypassed", () => {
  const config = settings();
  for (const address of ["Morning Star Street", "5th Avenue", "PO Box 123"]) {
    assert.throws(
      () => validateLead(lead(config, { address }), config),
      /house or building number/,
    );
    assert.throws(
      () => validateIntake({ ...base, address }),
      /house or building number/,
    );
  }
  assert.equal(
    validateLead(lead(config, { address: "123 Morning Star Street" }), config)
      .address,
    "123 Morning Star Street",
  );
  assert.equal(
    validateIntake({ ...base, address: "123 Morning Star Street" }).address,
    "123 Morning Star Street",
  );
});

test("Older Modernize receipts remain readable without relaxing new-submission validation", () => {
  const config = settings();
  const older = lead(config, { address: "Morning Star Street" });
  assert.equal(validateLead(older, config, false).address, older.address);
  assert.throws(() => validateLead(older, config), /house or building number/);
});
