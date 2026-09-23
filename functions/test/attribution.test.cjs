const { test } = require("node:test");
const assert = require("node:assert/strict");
const { sanitizeAttribution } = require("../lib/lead-attribution");

test("Attribution drops private data and forged variants while retaining campaign slugs", () => {
  assert.deepEqual(
    sanitizeAttribution({
      landingPath: "/roof-repair",
      variant: "replacement",
      utm_source: "facebook",
      utm_campaign: "repair-fall-2026",
      utm_content: "person@example.com",
      creative_id: "phone2105550123",
      utm_medium: "https://example.com/private",
      referrer: "https://example.com/?email=private",
    }),
    {
      landingPath: "/roof-repair",
      variant: "repair",
      utm_source: "facebook",
      utm_campaign: "repair-fall-2026",
    },
  );
  assert.equal(
    sanitizeAttribution({ landingPath: "/roof-repair?email=private" }),
    undefined,
  );
  assert.equal(
    sanitizeAttribution({ landingPath: "https://evil.example" }),
    undefined,
  );
  assert.equal(sanitizeAttribution(null), undefined);
});

test("Attribution accepts only bounded identifiers and supports legacy leads without metadata", () => {
  assert.equal(sanitizeAttribution(undefined), undefined);
  assert.deepEqual(
    sanitizeAttribution({
      landingPath: "/",
      utm_campaign: "a".repeat(65),
      utm_source: ["meta"],
      creative_id: "replacement-01",
    }),
    { landingPath: "/", variant: "general", creative_id: "replacement-01" },
  );
});
