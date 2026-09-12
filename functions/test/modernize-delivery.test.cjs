const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const { deliverModernize } = require("../lib/modernize-delivery");
const { settings, lead } = require("./modernize-fixtures.cjs");
const records = new Map();
let lock = Promise.resolve();
const snapshot = (ref) => ({
  exists: records.has(ref.path),
  get: (key) => records.get(ref.path)?.[key],
  data: () => records.get(ref.path),
});
const ref = (path) => ({
  path,
  get: async () => snapshot({ path }),
  update: async (patch) => {
    if (!records.has(path)) throw Error("missing");
    records.set(path, { ...records.get(path), ...patch });
  },
});
const db = {
  collection: (name) => ({ doc: (id) => ref(`${name}/${id}`) }),
  runTransaction: (fn) => {
    const operation = lock.then(async () => {
      const writes = [];
      const result = await fn({
        get: async (reference) => snapshot(reference),
        create: (reference, value) =>
          writes.push(() => {
            if (records.has(reference.path)) throw Error("duplicate");
            records.set(reference.path, value);
          }),
        set: (reference, value) =>
          writes.push(() => records.set(reference.path, value)),
      });
      writes.forEach((write) => write());
      return result;
    });
    lock = operation.catch(() => {});
    return operation;
  },
};
const load = Module._load;
Module._load = function (name, ...args) {
  if (name === "firebase-admin/firestore")
    return {
      getFirestore: (name) => {
        assert.equal(name, "roofzeus-leads");
        return db;
      },
      Timestamp: { fromMillis: (n) => n },
    };
  return load.call(this, name, ...args);
};
const {
  firestoreDeliveryStore,
  modernizeGateway,
} = require("../lib/modernize-gateway");
Module._load = load;
const response = (data) => ({ ok: true, status: 200, json: async () => data });
let calls, behavior;
const fetcher = async (url, options) => {
  calls.push({ url, options });
  if (url.includes("siteverify"))
    return response({
      success: behavior.security !== false,
      hostname: "localhost",
      action: "roofing-intake",
    });
  if (url.includes("zippopotam"))
    return response({
      places: [{ "state abbreviation": behavior.state || "TX" }],
    });
  assert.equal(new URL(url).hostname, "hsapiservice.quinstage.com");
  assert.equal(options.redirect, "error");
  if (url.endsWith("/pings")) {
    if (behavior.pingThrow) throw Error("offline");
    return response(
      behavior.ping || {
        status: "success",
        pingToken: "synthetic-ping",
        price: "75",
      },
    );
  }
  if (behavior.postThrow) throw Error("ambiguous timeout");
  return response(behavior.post || { status: "success", leadId: "12345678" });
};
const context = { ip: "192.0.2.1", hostname: "localhost" };
const deps = () => ({
  store: firestoreDeliveryStore(),
  secret: "test-secret",
  fetcher,
});
test.beforeEach(() => {
  records.clear();
  calls = [];
  behavior = {};
});

test("Actual Firestore adapter stores a confirmed lead, consent evidence and private partner result", async () => {
  const config = settings(),
    input = { ...lead(config), turnstileToken: "test" };
  const result = await deliverModernize(input, config, context, deps());
  assert.equal(result.status, "accepted");
  assert.deepEqual(
    Object.keys(result).sort(),
    ["reference", "status", "environment"].sort(),
  );
  const record = records.get(`modernizeRequests/${result.reference}`);
  assert.equal(record.partnerLeadId, "12345678");
  assert.equal(record.consentText, config.consentText);
  assert.equal(record.lead.trustedFormToken, input.trustedFormToken);
  const ping = JSON.parse(
    calls.find((call) => call.url.endsWith("/pings")).options.body,
  );
  assert.equal(ping.email, undefined);
  assert.equal(ping.address, undefined);
  assert.equal(JSON.stringify(record).includes("192.0.2.1"), false);
});
test("Concurrent retries deliver once; a retry with an expired bot token returns the receipt", async () => {
  const config = settings(),
    input = { ...lead(config), turnstileToken: "test" };
  const results = await Promise.all([
    deliverModernize(input, config, context, deps()),
    deliverModernize(input, config, context, deps()),
  ]);
  assert.equal(results[0].reference, results[1].reference);
  assert.equal(calls.filter((call) => call.url.endsWith("/posts")).length, 1);
  const count = calls.length;
  const retry = await deliverModernize(
    { ...input, turnstileToken: "" },
    config,
    context,
    deps(),
  );
  assert.equal(retry.status, "accepted");
  assert.equal(calls.length, count);
  await assert.rejects(
    deliverModernize(
      { ...input, email: "other@example.com" },
      config,
      context,
      deps(),
    ),
    /already been recorded/,
  );
});
test("A new request ID for the same project retrieves the first outcome without resale", async () => {
  const config = settings();
  const first = await deliverModernize(
    { ...lead(config), turnstileToken: "test" },
    config,
    context,
    deps(),
  );
  const second = await deliverModernize(
    { ...lead(config), turnstileToken: "test" },
    config,
    context,
    deps(),
  );
  assert.equal(second.reference, first.reference);
  assert.equal(calls.filter((call) => call.url.endsWith("/posts")).length, 1);
});
test("No bid, low bid, or invalid ping never sends contact details", async () => {
  for (const ping of [
    { status: "rejected" },
    { status: "success", pingToken: "p", price: "2" },
    { status: "success", price: "75" },
    { status: "error", message: "sensitive partner error" },
  ]) {
    records.clear();
    calls = [];
    behavior.ping = ping;
    const config = settings({ minimumPrice: 50 });
    const result = await deliverModernize(
      { ...lead(config), turnstileToken: "test" },
      config,
      context,
      deps(),
    );
    assert.notEqual(result.status, "accepted");
    assert.equal(calls.filter((call) => call.url.endsWith("/posts")).length, 0);
    assert.equal(JSON.stringify(result).includes("sensitive"), false);
  }
});
test("Post timeout/malformed reply is uncertain and cannot trigger an automatic retry", async () => {
  for (const mode of ["timeout", "malformed"]) {
    records.clear();
    calls = [];
    behavior =
      mode === "timeout"
        ? { postThrow: true }
        : { post: { status: "success" } };
    const config = settings(),
      input = { ...lead(config), turnstileToken: "test" };
    const result = await deliverModernize(input, config, context, deps());
    assert.equal(result.status, "unknown");
    await deliverModernize(input, config, context, deps());
    assert.equal(calls.filter((call) => call.url.endsWith("/posts")).length, 1);
  }
});
test("Post rejection is no match, not success; ping outage is not sent", async () => {
  const config = settings();
  behavior.post = { status: "rejected" };
  assert.equal(
    (
      await deliverModernize(
        { ...lead(config), turnstileToken: "test" },
        config,
        context,
        deps(),
      )
    ).status,
    "no_match",
  );
  records.clear();
  behavior = { pingThrow: true };
  assert.equal(
    (
      await deliverModernize(
        { ...lead(config), turnstileToken: "test" },
        config,
        context,
        deps(),
      )
    ).status,
    "not_sent",
  );
});
test("Disabled settings, stale consent, bad geography, security failure and public staging cannot deliver", async () => {
  const config = settings(),
    input = { ...lead(config), turnstileToken: "test" };
  await assert.rejects(
    deliverModernize(
      input,
      settings({ accountApproved: false }),
      context,
      deps(),
    ),
    /not open/,
  );
  await assert.rejects(
    deliverModernize(
      { ...input, consentVersion: "old" },
      config,
      context,
      deps(),
    ),
    /permission has changed/,
  );
  await assert.rejects(
    deliverModernize(
      input,
      config,
      { ...context, hostname: "roofzeus.com" },
      deps(),
    ),
    /local test/,
  );
  behavior.security = false;
  await assert.rejects(
    deliverModernize(input, config, context, deps()),
    /Security verification/,
  );
  behavior = { state: "MA" };
  await assert.rejects(
    deliverModernize(input, config, context, deps()),
    /ZIP code and state/,
  );
  assert.equal(
    calls.some((call) => call.url.includes("quinstage")),
    false,
  );
  assert.equal(records.size, 0);
});
test("Certificate reuse for another project is rejected; repeated contacts are rate-limited", async () => {
  const config = settings();
  const first = { ...lead(config), turnstileToken: "test" };
  await deliverModernize(first, config, context, deps());
  await assert.rejects(
    deliverModernize(
      { ...lead(config), plan: "repair", turnstileToken: "test" },
      config,
      context,
      deps(),
    ),
    /verification has already been used/,
  );
  for (let i = 0; i < 2; i++)
    await deliverModernize(
      { ...lead(config), turnstileToken: "test" },
      config,
      context,
      deps(),
    );
  await assert.rejects(
    deliverModernize(
      { ...lead(config), turnstileToken: "test" },
      config,
      context,
      deps(),
    ),
    /Too many/,
  );
});
test("HTTP gateway rejects foreign origins, exposes only public config, and blocks public staging", async () => {
  process.env.MODERNIZE_SETTINGS = JSON.stringify(settings());
  process.env.PUBLIC_ALLOWED_ORIGINS =
    "http://localhost:5175,https://roofzeus.com";
  async function request(origin, path = "/config", method = "GET") {
    const output = { statusCode: 200, headers: {} };
    const res = {
      set: (key, value) => {
        output.headers[key] = value;
        return res;
      },
      status: (code) => {
        output.statusCode = code;
        return res;
      },
      json: (body) => {
        output.body = body;
      },
      send: () => {},
    };
    await modernizeGateway(
      { get: (key) => (key === "origin" ? origin : ""), method, path },
      res,
    );
    return output;
  }
  assert.equal((await request("https://evil.test")).statusCode, 403);
  const config = await request("http://localhost:5175");
  assert.equal(config.body.enabled, true);
  assert.equal(config.body.tagId, undefined);
  assert.equal(config.headers["Cache-Control"], "no-store");
  assert.equal((await request("https://roofzeus.com")).body.enabled, false);
  assert.equal(
    (await request("http://localhost:5175", "/unknown")).statusCode,
    404,
  );
  assert.equal(
    (await request("http://localhost:5175", "/submit", "OPTIONS")).statusCode,
    204,
  );
});
