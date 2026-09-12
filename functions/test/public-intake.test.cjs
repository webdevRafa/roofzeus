const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const { randomUUID } = require("node:crypto");
const { CONSENT_VERSION } = require("../lib/intake-model");
process.env.TURNSTILE_SECRET_KEY = "unit-test-secret-not-for-deployment";
process.env.PUBLIC_INTAKE_ENABLED = "true";
process.env.PUBLIC_ALLOWED_ORIGINS = "https://roofzeus.com";
const records = new Map();
const snapshot = (ref) => ({
  exists: records.has(ref.path),
  get: (key) => records.get(ref.path)?.[key],
});
const makeRef = (path) => ({ path, get: async () => snapshot({ path }) });
const db = {
  collection: (name) => ({ doc: (id) => makeRef(`${name}/${id}`) }),
  runTransaction: async (fn) => {
    const writes = [];
    const transaction = {
      get: async (ref) => snapshot(ref),
      create: (ref, value) =>
        writes.push(() => {
          if (records.has(ref.path)) throw Error("already exists");
          records.set(ref.path, value);
        }),
      set: (ref, value) =>
        writes.push(() => {
          const previous = records.get(ref.path) || {};
          records.set(ref.path, {
            ...previous,
            ...value,
            count: (previous.count || 0) + 1,
          });
        }),
    };
    const result = await fn(transaction);
    writes.forEach((write) => write());
    return result;
  },
};
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === "firebase-admin/firestore")
    return {
      getFirestore: (name) => {
        assert.equal(name, "roofzeus-leads");
        return db;
      },
      Timestamp: { fromMillis: (ms) => ms },
      FieldValue: { increment: (n) => n, serverTimestamp: () => Date.now() },
    };
  return originalLoad.call(this, name, ...args);
};
const { submitPublicIntake } = require("../lib/public-intake");
Module._load = originalLoad;
let verified = true;
let geoFail = false;
let geoState = "TX";
let fetchCount = 0;
global.fetch = async (url) => {
  fetchCount++;
  if (url.includes("siteverify"))
    return {
      ok: true,
      json: async () => ({
        success: verified,
        action: "roofing-intake",
        hostname: "roofzeus.com",
      }),
    };
  if (geoFail) throw Error("offline");
  return {
    ok: true,
    json: async () => ({ places: [{ "state abbreviation": geoState }] }),
  };
};
const body = () => ({
  kind: "homeowner",
  requestId: randomUUID(),
  name: "Synthetic Homeowner",
  email: "test@example.com",
  phone: "",
  notes: "Test only",
  consent: true,
  consentVersion: CONSENT_VERSION,
  address: "123 Test Lane",
  city: "San Antonio",
  state: "TX",
  zip: "78209",
  service: "roof-repair",
  urgency: "Within a month",
  propertyType: "Single-family home",
  roofMaterial: "Not sure",
  authorized: true,
  contactMethod: "email",
  turnstileToken: "unit-token",
});
async function request(data, options = {}) {
  const req = {
    method: options.method || "POST",
    ip: options.ip || "192.0.2.1",
    body: data,
    rawBody: Buffer.from(JSON.stringify(data)),
    get: (key) =>
      key === "origin" ? options.origin || "https://roofzeus.com" : undefined,
    is: (type) => type === "application/json",
  };
  const result = { status: 200, headers: {} };
  const res = {
    set: (key, value) => {
      result.headers[key] = value;
      return res;
    },
    status: (status) => {
      result.status = status;
      return res;
    },
    json: (value) => {
      result.body = value;
      return res;
    },
    send: (value) => {
      result.body = value;
      return res;
    },
  };
  await submitPublicIntake(req, res);
  return result;
}
test.beforeEach(() => {
  records.clear();
  verified = true;
  geoFail = false;
  geoState = "TX";
  fetchCount = 0;
  process.env.PUBLIC_INTAKE_ENABLED = "true";
});
test("Persists a private lead and returns only a reference", async () => {
  const result = await request(body());
  assert.equal(result.status, 201);
  assert.match(result.body.reference, /^RZ-[A-F0-9]{16}$/);
  assert.deepEqual(Object.keys(result.body), ["reference"]);
  const lead = records.get(`requests/${result.body.reference}`);
  assert.equal(lead.status, "new");
  assert.equal(lead.sharingStatus, "not_shared");
  assert.equal(lead.namedPartnerConsent, null);
  assert.equal(lead.geoValidation, "zip_state_matched");
  assert.ok(!JSON.stringify(lead).includes("unit-token"));
  assert.ok(!JSON.stringify(lead).includes("192.0.2.1"));
});
test("Retry after lost response is idempotent even with an expired token", async () => {
  const data = body();
  const first = await request(data);
  verified = false;
  const second = await request(data);
  assert.equal(second.status, 200);
  assert.equal(second.body.reference, first.body.reference);
  assert.equal(fetchCount, 2);
  assert.equal(
    [...records.keys()].filter((k) => k.startsWith("requests/")).length,
    1,
  );
});
test("Changed payload cannot reuse a receipt", async () => {
  const data = body();
  await request(data);
  const result = await request({ ...data, notes: "changed" });
  assert.equal(result.status, 409);
});
test("Same project from a new request ID is deduplicated", async () => {
  const first = await request(body());
  const second = await request(body());
  assert.equal(first.body.reference, second.body.reference);
  assert.equal(
    [...records.keys()].filter((k) => k.startsWith("requests/")).length,
    1,
  );
});
test("Rejects invalid security tokens without writing leads", async () => {
  verified = false;
  assert.equal((await request(body())).status, 400);
  assert.equal(records.size, 0);
});
test("Rejects unauthorized origins and supports CORS preflight", async () => {
  assert.equal(
    (await request(body(), { origin: "https://attacker.example" })).status,
    403,
  );
  const preflight = await request({}, { method: "OPTIONS" });
  assert.equal(preflight.status, 204);
  assert.equal(
    preflight.headers["Access-Control-Allow-Origin"],
    "https://roofzeus.com",
  );
  assert.equal(records.size, 0);
});
test("Disabled launch gate never accepts a lead", async () => {
  process.env.PUBLIC_INTAKE_ENABLED = "false";
  assert.equal((await request(body())).status, 503);
  assert.equal(records.size, 0);
});
test("Location outage queues manual review rather than losing the request", async () => {
  geoFail = true;
  const result = await request(body());
  assert.equal(result.status, 201);
  assert.equal(
    records.get(`requests/${result.body.reference}`).geoValidation,
    "manual_review_required",
  );
});
test("Rejects conflicting ZIP/state before writing", async () => {
  geoState = "MA";
  assert.equal((await request(body())).status, 400);
  assert.equal(records.size, 0);
});
test("Rate limits repeated contacts, including duplicate submissions", async () => {
  for (let i = 0; i < 3; i++) assert.equal((await request(body())).status, 201);
  assert.equal((await request(body())).status, 429);
});
test("Contractor registration is pending, never auto-approved", async () => {
  const result = await request({
    ...body(),
    kind: "contractor",
    businessName: "Example Roofing",
    phone: "2105550123",
    territoryZips: "78209,78201",
  });
  assert.equal(result.status, 201);
  const partner = records.get(
    `contractorApplications/${result.body.reference}`,
  );
  assert.equal(partner.status, "new");
  assert.deepEqual(partner.territoryZips, ["78209", "78201"]);
});
