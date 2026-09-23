import { test, expect, type Page } from "@playwright/test";
import {
  analyticsBeforeSend,
  captureAttribution,
} from "../../src/public-site/attribution";
const consent =
  "TEST FIXTURE ONLY: I agree to this synthetic Modernize referral and test contact permission. No real lead is delivered.";
const certificate = "https://cert.trustedform.com/" + "a".repeat(40);
const config = {
  enabled: true,
  mode: "api",
  environment: "staging",
  version: "fixture-version",
  consentVersion: "fixture-v1",
  consentText: consent,
  consentAdvertiserName: "Modernize",
  trustedFormScriptUrl:
    "https://api.trustedform.com/trustedform.js?field=xxTrustedFormCertUrl&use_tagged_consent=true&sandbox=true",
  materials: ["asphalt", "metal"],
  affiliateUrl: "",
};
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.set(window, "funnelSubmitCount", 0);
    document.addEventListener(
      "submit",
      (event) => {
        if (
          (event.target as Element).matches(
            'form[data-tf-element-role="offer"]',
          )
        ) {
          Reflect.set(
            window,
            "funnelSubmitCount",
            Reflect.get(window, "funnelSubmitCount") + 1,
          );
        }
      },
      true,
    );
  });
  await page.route("**/modernize-test/config", (route) =>
    route.fulfill({ json: config }),
  );
  await page.route("https://api.trustedform.com/**", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `const form=document.querySelector('form[data-tf-element-role="offer"]');if(!form)throw Error('Form must exist first');const field=document.createElement('input');field.type='hidden';field.name='xxTrustedFormCertUrl';field.value='${certificate}';form.append(field);window.testStopCount=0;window.trustedFormStopRecording=()=>{window.testStopCount++;window.testFormPresentAtStop=!!document.querySelector('form[data-tf-element-role="offer"]')};`,
    }),
  );
  await page.route("https://challenges.cloudflare.com/**", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "window.turnstile={render(el,o){setTimeout(()=>o.callback('fixture-token'),10);return 'fixture'},remove(){}}",
    }),
  );
  await page.route("https://api.zippopotam.us/**", (route) =>
    route.fulfill({
      json: {
        places: [{ "place name": "San Antonio", "state abbreviation": "TX" }],
      },
    }),
  );
});
async function start(page: Page, address = false, path = "/") {
  await page.goto(path);
  if (address) {
    await page
      .getByRole("button", { name: "Full address", exact: true })
      .click();
    await page
      .getByLabel("Street address", { exact: true })
      .fill("123 Example Lane");
    await page.getByLabel("City", { exact: true }).fill("San Antonio");
    await page
      .getByRole("combobox", { name: "State", exact: true })
      .selectOption("TX");
    await page.getByLabel("ZIP code", { exact: true }).fill("78209");
  } else await page.locator("#zip-start").fill("78209");
  await page
    .getByRole("button", { name: /^(Get my estimate|Preview the form)$/ })
    .click();
}
async function complete(page: Page, path = "/") {
  await start(page, true, path);
  await page.getByLabel("Roof replacement", { exact: true }).check();
  await page
    .getByRole("combobox", { name: /What material/ })
    .selectOption("asphalt");
  await page
    .getByRole("combobox", { name: "When do you need help?", exact: true })
    .selectOption("Immediately");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Street address", { exact: true })).toHaveValue(
    "123 Example Lane",
  );
  await page.getByLabel("I own this property").check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("First name", { exact: true }).fill("Synthetic");
  await page.getByLabel("Last name", { exact: true }).fill("Homeowner");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("synthetic@example.com");
  await page.getByLabel("Phone number", { exact: true }).fill("2105550123");
  await expect(page.getByLabel(consent, { exact: true })).not.toBeChecked();
  await page.getByLabel(consent, { exact: true }).check();
}

test("Campaign attribution survives form navigation and excludes arbitrary URL data", async ({
  page,
}) => {
  let submitted = false;
  await page.route("**/modernize-test/submit", (route) => {
    const body = route.request().postDataJSON();
    expect(body.attribution).toEqual({
      landingPath: "/roof-replacement",
      variant: "replacement",
      utm_source: "facebook",
      utm_campaign: "roofing-review",
      creative_id: "replacement-01",
    });
    submitted = true;
    return route.fulfill({
      json: {
        reference: "RZM-0123456789ABCDEF",
        status: "accepted",
        environment: "staging",
      },
    });
  });
  await complete(
    page,
    "/roof-replacement?utm_source=facebook&utm_campaign=roofing-review&creative_id=replacement-01&utm_content=someone%40example.com",
  );
  expect(page.url()).not.toContain("utm_");
  await page
    .getByRole("button", { name: "Get my estimate", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your request is on its way." }),
  ).toBeVisible();
  expect(submitted).toBe(true);
});

for (const [path, selection] of [
  ["/roof-repair", "Roof repair"],
  ["/roof-replacement", "Roof replacement"],
]) {
  test(`Campaign sample flow is isolated and project is editable: ${path}`, async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        url.pathname.startsWith("/modernize-test/") ||
        url.pathname === "/api/visitor-area" ||
        url.pathname.startsWith("/_vercel/insights/") ||
        /(^|\.)(trustedform\.com|challenges\.cloudflare\.com|maps\.googleapis\.com|zippopotam\.us)$/.test(
          url.hostname,
        )
      )
        requests.push(request.url());
    });
    await page.goto(path + "?preview=1");
    await page.locator("#zip-start").fill("78209");
    await page.getByRole("button", { name: "Start demo", exact: true }).click();
    await expect(page.getByLabel(selection, { exact: true })).toBeChecked();
    const other =
      selection === "Roof repair" ? "Roof replacement" : "Roof repair";
    await page.getByLabel(other, { exact: true }).check();
    await expect(page.getByLabel(other, { exact: true })).toBeChecked();
    await expect(page.getByLabel(selection, { exact: true })).not.toBeChecked();
    expect(requests).toEqual([]);
    expect(
      await page.evaluate(() => ({
        local: { ...localStorage },
        session: { ...sessionStorage },
      })),
    ).toEqual({ local: {}, session: {} });
  });
}

test("Property ZIP overrides visitor area and stale city is removed during edits", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/visitor-area", (route) =>
    route.fulfill({ json: { area: "Austin, TX" } }),
  );
  await page.goto("/roof-repair");
  const label = page.locator(".rz-area-banner h2");
  await expect(label).toHaveText("Explore roofing estimates near Austin, TX", {
    timeout: 7000,
  });
  await page.locator("#zip-start").fill("78209");
  await expect(label).toHaveText(
    "Explore roofing estimates near San Antonio, TX",
  );
  await page.locator("#zip-start").fill("7820");
  await expect(label).toHaveText("Explore roofing estimates in your area");
  await page.getByRole("button", { name: "Full address", exact: true }).click();
  await expect(label).toHaveText("Explore roofing estimates near Austin, TX");
  await page.getByLabel("ZIP code", { exact: true }).fill("78209");
  await expect(label).toHaveText(
    "Explore roofing estimates near San Antonio, TX",
  );
});

test("Review downloads exist and campaign pages fit narrow screens", async ({
  page,
}) => {
  for (const path of [
    "/roof-repair",
    "/roof-replacement",
    "/partner-preview",
  ]) {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex,follow",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  const downloads = await page
    .locator("a[download]")
    .evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).href));
  expect(downloads).toHaveLength(10);
  for (const url of downloads) {
    const response = await page.request.get(url);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).not.toContain("text/html");
  }
});

test("Analytics strips URL fields and excludes reviewer and demo activity", () => {
  expect(
    analyticsBeforeSend({
      url: "https://roofzeus.com/roof-repair?zip=78209&email=a%40b.com#private",
    }),
  ).toEqual({ url: "https://roofzeus.com/roof-repair" });
  for (const path of ["/demo", "/partner-preview", "/roof-repair?preview=1"])
    expect(
      analyticsBeforeSend({ url: "https://roofzeus.com" + path }),
    ).toBeNull();
  expect(
    captureAttribution("/roof-repair", "?utm_source=facebook", true),
  ).toBeUndefined();
});
test("New form carries address, certificate and exact consent version; only confirmed partner success is shown", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let count = 0;
  await page.route("**/modernize-test/submit", (route) => {
    count++;
    const body = route.request().postDataJSON();
    expect(body.trustedFormToken).toBe(certificate);
    expect(body.consentVersion).toBe("fixture-v1");
    expect(body.configVersion).toBe("fixture-version");
    expect(body.address).toBe("123 Example Lane");
    expect(body.material).toBe("asphalt");
    expect(body.plan).toBe("replacement");
    expect(body.consent).toBe(true);
    expect(body.phone).toBe("2105550123");
    return route.fulfill({
      json: {
        reference: "RZM-0123456789ABCDEF",
        status: "accepted",
        environment: "staging",
      },
    });
  });
  await complete(page);
  expect(
    await page.evaluate(() => Reflect.get(window, "funnelSubmitCount")),
  ).toBe(0);
  expect(page.url()).not.toContain("Example");
  await expect(
    page.locator('[data-tf-element-role="consent-language"]'),
  ).toHaveText(consent);
  await expect(
    page.locator('[data-tf-element-role="consent-advertiser-name"]'),
  ).toHaveText("Modernize");
  await expect(
    page.locator('[data-tf-element-role="consent-grantor-phone"]'),
  ).toHaveValue("(210) 555-0123");
  await expect(
    page.locator('[data-tf-element-role="consent-grantor-email"]'),
  ).toHaveValue("synthetic@example.com");
  await page
    .getByRole("button", { name: "Get my estimate", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your request is on its way." }),
  ).toBeVisible();
  await expect(
    page.getByText("Test submission only.", { exact: false }),
  ).toBeVisible();
  expect(count).toBe(1);
  expect(
    await page.evaluate(() => Reflect.get(window, "funnelSubmitCount")),
  ).toBe(1);
  expect(await page.evaluate(() => Reflect.get(window, "testStopCount"))).toBe(
    1,
  );
  expect(
    await page.evaluate(() => Reflect.get(window, "testFormPresentAtStop")),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("Uncertain network response freezes submitted details and retries the same receipt", async ({
  page,
}) => {
  let id = "",
    attempts = 0;
  await page.route("**/modernize-test/submit", (route) => {
    const payload = route.request().postDataJSON();
    if (attempts++ === 0) {
      id = payload.requestId;
      return route.abort();
    }
    expect(payload.requestId).toBe(id);
    return route.fulfill({
      json: {
        reference: "RZM-0123456789ABCDEF",
        status: "unknown",
        environment: "staging",
      },
    });
  });
  await complete(page);
  await page
    .getByRole("button", { name: "Get my estimate", exact: true })
    .click();
  await expect(page.getByLabel("First name", { exact: true })).toBeDisabled();
  const checkStatus = page.getByRole("button", {
    name: "Check submission status",
  });
  await expect(checkStatus).toHaveAttribute("type", "button");
  await expect(checkStatus).not.toHaveAttribute(
    "data-tf-element-role",
    "submit",
  );
  await expect(page.locator('[data-tf-element-role="submit"]')).toBeDisabled();
  await checkStatus.click();
  await expect(
    page.getByRole("heading", { name: "We’re checking your request." }),
  ).toBeVisible();
  await expect(
    page.getByText("Your request is on its way.", { exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => Reflect.get(window, "funnelSubmitCount")),
  ).toBe(1);
});
test("Unavailable matching and missing certificate never submit or invent permission", async ({
  page,
}) => {
  let submits = 0,
    certLoads = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/submit")) submits++;
    if (request.url().includes("api.trustedform.com")) certLoads++;
  });
  await page.route("**/modernize-test/config", (route) =>
    route.fulfill({
      json: {
        ...config,
        enabled: false,
        consentText: "",
        trustedFormScriptUrl: "",
      },
    }),
  );
  await start(page);
  await page.getByLabel("Roof repair", { exact: true }).check();
  await page
    .getByRole("combobox", { name: /What material/ })
    .selectOption("asphalt");
  await page
    .getByRole("combobox", { name: "When do you need help?", exact: true })
    .selectOption("Immediately");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByLabel("Street address", { exact: true })
    .fill("123 Example Lane");
  await page.getByLabel("I own this property").check();
  await expect(page.getByLabel("City", { exact: true })).toHaveValue(
    "San Antonio",
  );
  await expect(
    page.getByRole("combobox", { name: "State", exact: true }),
  ).toHaveValue("TX");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Check my details", exact: true }),
  ).toBeEnabled();
  await expect(
    page.locator('[data-tf-element-role="consent-language"]'),
  ).toHaveCount(0);
  expect(submits).toBe(0);
  expect(certLoads).toBe(0);
  await page.route("**/modernize-test/config", (route) =>
    route.fulfill({ json: config }),
  );
  await page.route("https://api.trustedform.com/**", (route) => route.abort());
  await complete(page);
  await expect(
    page.getByRole("button", { name: "Get my estimate", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText(
    "verification could not load",
  );
  expect(submits).toBe(0);
});
test("Hosted mode hands off an exact approved link without address or contact query parameters", async ({
  page,
}) => {
  const url = "https://modernize.com/roofing?affiliate=fixture";
  await page.route("**/modernize-test/config", (route) =>
    route.fulfill({ json: { ...config, mode: "hosted", affiliateUrl: url } }),
  );
  await start(page, true);
  const link = page.getByRole("link", { name: "Continue to Modernize" });
  await expect(link).toHaveAttribute("href", url);
  await expect(link).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(
    page.getByText(
      "Your address and contact details are not sent by this link.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(page.getByLabel("First name")).toHaveCount(0);
});
test("Both entry modes fit desktop and mobile", async ({ page }) => {
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await complete(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `width ${width}`,
    ).toBe(true);
  }
  await start(page);
});

test("Project questions reveal only applicable fields and reset answers when the scope changes", async ({
  page,
}) => {
  await start(page);
  await expect(page.locator('input[name="plan"]')).toHaveCount(3);
  await expect(page.getByLabel("Inspection / not sure")).toHaveCount(0);
  await expect(page.locator('select[name="material"]')).toHaveCount(0);
  await expect(page.locator('select[name="timeframe"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "What does your roof need?" }),
  ).toBeVisible();
  await page.getByLabel("Roof repair", { exact: true }).check();
  const material = page.getByLabel("What material is on your roof now?");
  await expect(material.locator("option")).toHaveText([
    "Choose a material",
    "Asphalt shingles",
    "Metal",
  ]);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "What does your roof need?" }),
  ).toBeVisible();
  await material.selectOption("metal");
  await page.getByLabel("When do you need help?").selectOption("Immediately");
  await page.getByLabel("New construction", { exact: true }).check();
  await expect(
    page.getByLabel("What material would you like installed?"),
  ).toHaveValue("");
  await expect(page.locator('select[name="timeframe"]')).toHaveCount(0);
  await page
    .getByLabel("What material would you like installed?")
    .selectOption("asphalt");
  await expect(page.getByLabel("When do you need help?")).toHaveValue("");
  await page.getByLabel("When do you need help?").selectOption("Don't know");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Which home is it for?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByLabel("New construction", { exact: true }),
  ).toBeChecked();
  await expect(
    page.getByLabel("What material would you like installed?"),
  ).toHaveValue("asphalt");
  await expect(page.getByLabel("When do you need help?")).toHaveValue(
    "Don't know",
  );
});

test("All documented roofing plan and material combinations can reach the property step", async ({
  page,
}) => {
  const materials = [
    "asphalt",
    "composite",
    "metal",
    "tile",
    "slate",
    "cedar",
    "tar",
  ];
  await page.route("**/modernize-test/config", (route) =>
    route.fulfill({ json: { ...config, materials } }),
  );
  await start(page);
  for (const plan of ["Roof repair", "Roof replacement", "New construction"]) {
    for (const material of materials) {
      await page.getByLabel(plan, { exact: true }).check();
      await page.locator('select[name="material"]').selectOption(material);
      await page
        .getByLabel("When do you need help?")
        .selectOption("1-6 months");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Which home is it for?" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Back", exact: true }).click();
    }
  }
});

test("Unsupported materials are never offered and no available materials cannot collect contact details", async ({
  page,
}) => {
  let submits = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/submit")) submits++;
  });
  await page.route("**/modernize-test/config", (route) =>
    route.fulfill({ json: { ...config, materials: ["tile"] } }),
  );
  await start(page, true);
  await page.getByLabel("Roof replacement", { exact: true }).check();
  await expect(page.locator('select[name="material"] option')).toHaveText([
    "Choose a material",
    "Tile",
  ]);
  await page.getByText("Not sure about the material?", { exact: true }).click();
  await expect(
    page.getByText("Inspection-only requests aren’t available", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.locator('option[value="unknown"],option[value="other"]'),
  ).toHaveCount(0);
  await page.route("**/modernize-test/config", (route) =>
    route.fulfill({ json: { ...config, materials: [] } }),
  );
  await start(page);
  await page.getByLabel("Roof repair", { exact: true }).check();
  await expect(page.getByRole("status")).toContainText("aren’t available");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "choose a roofing project",
  );
  await expect(page.getByLabel("First name")).toHaveCount(0);
  expect(submits).toBe(0);
});

test("Phone typing formats digits, blocks letters, supports +1 paste, and preserves middle edits", async ({
  page,
}) => {
  await complete(page);
  const phone = page.getByLabel("Phone number", { exact: true });
  await phone.fill("");
  await phone.pressSequentially("2105550123", { delay: 35 });
  await expect(phone).toHaveValue("(210) 555-0123");
  await phone.pressSequentially("abc");
  await expect(phone).toHaveValue("(210) 555-0123");
  await expect(page.locator("#modernize-phone-error")).toHaveCount(0);
  expect(
    await phone.evaluate((el: HTMLInputElement) => el.checkValidity()),
  ).toBe(true);
  await phone.fill("+1 (212) 555-0123");
  await expect(phone).toHaveValue("(212) 555-0123");
  // A real clipboard paste, including the country code and punctuation.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate(() => navigator.clipboard.writeText("+1 (210) 555-0123"));
  await phone.press("ControlOrMeta+A");
  await phone.press("ControlOrMeta+V");
  await expect(phone).toHaveValue("(210) 555-0123");
  await phone.evaluate((el: HTMLInputElement) => el.setSelectionRange(2, 3));
  await phone.pressSequentially("2");
  await expect(phone).toHaveValue("(220) 555-0123");
  await phone.evaluate((el: HTMLInputElement) => el.setSelectionRange(10, 10));
  await phone.press("Backspace");
  await expect(phone).toHaveValue("(220) 550-123");
  await phone.pressSequentially("5");
  await expect(phone).toHaveValue("(220) 555-0123");
  await phone.press("ControlOrMeta+A");
  await phone.press("Backspace");
  await expect(phone).toHaveValue("");
  await phone.fill("210555012");
  await phone.blur();
  await expect(phone).toHaveAttribute("aria-invalid", "true");
  await phone.fill("2105550123");
  await expect(phone).not.toHaveAttribute("aria-invalid", "true");
  await phone.fill("210555012345");
  await expect(phone).toHaveValue("(210) 555-0123");
  await expect(page.locator("#modernize-phone-error")).toHaveCount(0);
  expect(
    await phone.evaluate((el: HTMLInputElement) => el.checkValidity()),
  ).toBe(true);
  // Rejected input must still leave an empty/incomplete number invalid.
  await phone.fill("");
  await phone.pressSequentially("abc");
  await expect(page.locator("#modernize-phone-error")).toContainText("Letters");
  expect(
    await phone.evaluate((el: HTMLInputElement) => el.checkValidity()),
  ).toBe(false);
});

test("Invalid contacts block submission and valid contacts enable a confirmed request", async ({
  page,
}) => {
  let submits = 0;
  await page.route("**/modernize-test/submit", (route) => {
    submits++;
    const payload = route.request().postDataJSON();
    expect(payload.phone).toBe("2105550123");
    expect(payload.email).toBe("first.last+roof@example.com");
    return route.fulfill({
      json: {
        reference: "RZM-0123456789ABCDEF",
        status: "accepted",
        environment: "staging",
      },
    });
  });
  await complete(page);
  const email = page.getByLabel("Email address", { exact: true });
  const phone = page.getByLabel("Phone number", { exact: true });
  const submit = page.getByRole("button", {
    name: "Get my estimate",
    exact: true,
  });
  await expect(submit).toBeEnabled();
  for (const invalid of [
    "name@example",
    "first..last@example.com",
    "name@example..com",
    "name@-example.com",
    "name@@example.com",
  ]) {
    await email.fill(invalid);
    await email.blur();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await submit.click();
    expect(submits).toBe(0);
  }
  await email.fill(" First.Last+Roof@Example.COM ");
  await email.blur();
  await expect(email).toHaveValue("first.last+roof@example.com");
  await expect(email).not.toHaveAttribute("aria-invalid", "true");
  await phone.fill("2101550123");
  await phone.blur();
  await submit.click();
  expect(submits).toBe(0);
  await phone.fill("+1 210 555 0123");
  await phone.press("End");
  await phone.pressSequentially("456789");
  await expect(phone).toHaveValue("(210) 555-0123");
  await expect(page.locator("#modernize-phone-error")).toHaveCount(0);
  expect(
    await phone.evaluate((el: HTMLInputElement) => el.checkValidity()),
  ).toBe(true);
  await submit.click();
  await expect(
    page.getByRole("heading", { name: "Your request is on its way." }),
  ).toBeVisible();
  expect(submits).toBe(1);
});

test("Closed matching has a working format check and clearly says nothing is submitted", async ({
  page,
}) => {
  let submits = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/submit")) submits++;
  });
  await page.route("**/modernize-test/config", (route) =>
    route.fulfill({
      json: {
        ...config,
        enabled: false,
        consentText: "",
        trustedFormScriptUrl: "",
      },
    }),
  );
  await start(page, true);
  await expect(page.getByText("Preview only.", { exact: false })).toBeVisible();
  await page.getByLabel("Roof replacement", { exact: true }).check();
  await page
    .getByLabel("What material would you like installed?")
    .selectOption("asphalt");
  await page.getByLabel("When do you need help?").selectOption("Immediately");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("I own this property").check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("First name", { exact: true }).fill("Synthetic");
  await page.getByLabel("Last name", { exact: true }).fill("Homeowner");
  await page.getByLabel("Email address", { exact: true }).fill("name@example");
  await page.getByLabel("Phone number", { exact: true }).fill("2105550123");
  const check = page.getByRole("button", {
    name: "Check my details",
    exact: true,
  });
  await expect(check).toBeEnabled();
  await check.click();
  await expect(
    page.getByText("Format checks passed.", { exact: false }),
  ).toHaveCount(0);
  await page
    .getByLabel("Email address", { exact: true })
    .fill("name@example.com");
  await check.click();
  await expect(page.getByRole("status")).toContainText(
    "your details have not been submitted",
  );
  await page
    .getByLabel("Email address", { exact: true })
    .fill("changed@example.com");
  await expect(
    page.getByText("Format checks passed.", { exact: false }),
  ).toHaveCount(0);
  expect(submits).toBe(0);
});

for (const addressEntry of [false, true]) {
  test(`Demo route completes ${addressEntry ? "address" : "ZIP"} entry without live services, storage or delivery`, async ({
    page,
  }) => {
    const serviceRequests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        url.pathname.startsWith("/modernize-test/") ||
        /(^|\.)(trustedform\.com|challenges\.cloudflare\.com|maps\.googleapis\.com|zippopotam\.us)$/.test(
          url.hostname,
        )
      )
        serviceRequests.push(request.url());
    });
    await page.goto("/demo?environment=production&enabled=true");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex,follow",
    );
    await expect(page.getByRole("note")).toContainText("Demo mode");
    if (addressEntry) {
      await page
        .getByRole("button", { name: "Full address", exact: true })
        .click();
      await page
        .getByLabel("Street address", { exact: true })
        .fill("123 Example Lane");
      await page.getByLabel("City", { exact: true }).fill("San Antonio");
      await page
        .getByRole("combobox", { name: "State", exact: true })
        .selectOption("TX");
      await page.getByLabel("ZIP code", { exact: true }).fill("78209");
    } else await page.locator("#zip-start").fill("78209");
    await page.getByRole("button", { name: "Start demo", exact: true }).click();
    await page.getByLabel("Roof replacement", { exact: true }).check();
    await page
      .getByRole("combobox", { name: /What material/ })
      .selectOption("asphalt");
    await page
      .getByRole("combobox", { name: "When do you need help?", exact: true })
      .selectOption("Immediately");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    if (!addressEntry) {
      await page
        .getByLabel("Street address", { exact: true })
        .fill("123 Example Lane");
      await page.getByLabel("City", { exact: true }).fill("San Antonio");
      await page
        .getByRole("combobox", { name: "State", exact: true })
        .selectOption("TX");
    } else
      await expect(
        page.getByLabel("Street address", { exact: true }),
      ).toHaveValue("123 Example Lane");
    await page.getByLabel("I own this property").check();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByLabel("First name", { exact: true }).fill("Sample");
    await page.getByLabel("Last name", { exact: true }).fill("Homeowner");
    await page
      .getByLabel("Email address", { exact: true })
      .fill("sample@example");
    await page.getByLabel("Phone number", { exact: true }).fill("2105550123");
    await page
      .getByRole("button", { name: "Complete demo", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Demo completed successfully." }),
    ).toHaveCount(0);
    await page
      .getByLabel("Email address", { exact: true })
      .fill("sample@example.com");
    await page
      .getByRole("button", { name: "Complete demo", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Demo completed successfully." }),
    ).toBeFocused();
    await expect(
      page.getByText("No lead was saved or sent", { exact: false }),
    ).toBeVisible();
    expect(serviceRequests).toEqual([]);
    expect(
      await page.evaluate(() => ({
        local: { ...localStorage },
        session: { ...sessionStorage },
      })),
    ).toEqual({ local: {}, session: {} });
    expect(page.url()).not.toMatch(/78209|Example|sample/);
    await page.getByRole("button", { name: "Try the demo again" }).click();
    await expect(page.locator("#zip-start")).toHaveValue("");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("Desktop hero, image, headline and footer stay fixed through long forms and navigation", async ({
  page,
}) => {
  await page.route("**/modernize-test/config", (route) =>
    route.fulfill({
      json: {
        ...config,
        consentText:
          consent +
          " Additional approved-text fixture for layout testing.".repeat(90),
      },
    }),
  );
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const geometry = () =>
    page.evaluate(() =>
      Object.fromEntries(
        [
          ".rz-estimate-hero",
          ".rz-estimate-house",
          ".rz-estimate-copy",
          ".rz-estimate-panel",
          ".rz-estimate-footer",
        ].map((selector) => {
          const r = document.querySelector(selector)!.getBoundingClientRect();
          return [
            selector,
            [
              Math.round(r.top + scrollY),
              Math.round(r.height),
              Math.round(r.width),
            ],
          ];
        }),
      ),
    );
  const before = await geometry();
  await page.getByRole("button", { name: "Full address", exact: true }).click();
  expect(await geometry()).toEqual(before);
  await page
    .getByLabel("Street address", { exact: true })
    .fill("123 Example Lane");
  await page.getByLabel("City", { exact: true }).fill("San Antonio");
  await page
    .getByRole("combobox", { name: "State", exact: true })
    .selectOption("TX");
  await page.getByLabel("ZIP code", { exact: true }).fill("78209");
  await page
    .getByRole("button", { name: "Get my estimate", exact: true })
    .click();
  await page.getByLabel("Roof replacement", { exact: true }).check();
  await page
    .getByRole("combobox", { name: /What material/ })
    .selectOption("asphalt");
  await page
    .getByRole("combobox", { name: "When do you need help?", exact: true })
    .selectOption("Immediately");
  await page.getByText("Not sure about the material?", { exact: true }).click();
  expect(await geometry()).toEqual(before);
  const formNode = await page
    .locator('form[data-tf-element-role="offer"]')
    .elementHandle();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".rz-estimate-steps")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  expect(await geometry()).toEqual(before);
  await page.getByLabel("I own this property").check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".rz-estimate-steps")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  expect(await geometry()).toEqual(before);
  expect(
    await formNode!.evaluate(
      (node) =>
        node === document.querySelector('form[data-tf-element-role="offer"]'),
    ),
  ).toBe(true);
  expect(
    await page
      .locator("#estimate-funnel")
      .evaluate((el) => el.scrollHeight > el.clientHeight),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Get my estimate", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "Get my estimate", exact: true }),
  ).toBeInViewport();
  expect(await geometry()).toEqual(before);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.locator(".rz-estimate-steps")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.getByLabel("Street address", { exact: true })).toHaveValue(
    "123 Example Lane",
  );
  expect(await geometry()).toEqual(before);
});

test("Reduced motion and mobile keep natural scrolling with a stable background size", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const imageHeight = await page
    .locator(".rz-estimate-house")
    .evaluate((el) => el.getBoundingClientRect().height);
  await complete(page);
  expect(
    await page
      .locator(".rz-estimate-house")
      .evaluate((el) => el.getBoundingClientRect().height),
  ).toBe(imageHeight);
  expect(
    await page
      .locator("#estimate-funnel")
      .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
  ).toBe(true);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("Padded or blank property fields cannot advance in either address entry step", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Full address", exact: true }).click();
  const street = page.getByLabel("Street address", { exact: true });
  const city = page.getByLabel("City", { exact: true });
  await street.fill("  abc  ");
  await city.fill(" X ");
  await page
    .getByRole("combobox", { name: "State", exact: true })
    .selectOption("TX");
  await page.getByLabel("ZIP code", { exact: true }).fill("78209");
  await page
    .getByRole("button", { name: "Get my estimate", exact: true })
    .click();
  await expect(street).toBeVisible();
  expect(
    await street.evaluate((input: HTMLInputElement) => input.checkValidity()),
  ).toBe(false);
  await street.fill(" 123 Example Lane ");
  await page
    .getByRole("button", { name: "Get my estimate", exact: true })
    .click();
  expect(
    await city.evaluate((input: HTMLInputElement) => input.checkValidity()),
  ).toBe(false);
  await city.fill(" San Antonio ");
  await page
    .getByRole("button", { name: "Get my estimate", exact: true })
    .click();
  await page.getByLabel("Roof replacement", { exact: true }).check();
  await page
    .getByRole("combobox", { name: /What material/ })
    .selectOption("asphalt");
  await page
    .getByRole("combobox", { name: "When do you need help?", exact: true })
    .selectOption("Immediately");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(street).toHaveValue("123 Example Lane");
  await expect(city).toHaveValue("San Antonio");
  await page.getByLabel("I own this property").check();
  await street.fill("     ");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(street).toBeVisible();
  await street.fill("123 Example Lane");
  await city.fill(" X ");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(city).toBeVisible();
  await city.fill("San Antonio");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("First name", { exact: true })).toBeVisible();
});

test("An older or incomplete gateway config cannot enable untagged consent submission", async ({
  page,
}) => {
  let certificateLoads = 0;
  page.on("request", (request) => {
    if (request.url().includes("api.trustedform.com")) certificateLoads++;
  });
  await page.route("**/modernize-test/config", (route) =>
    route.fulfill({ json: { ...config, consentAdvertiserName: "" } }),
  );
  await start(page);
  await expect(page.getByText(/Preview only/)).toBeVisible();
  expect(certificateLoads).toBe(0);
});

test("A cleared or malformed certificate cannot reuse the last valid certificate", async ({
  page,
}) => {
  let submissions = 0;
  await page.route("**/modernize-test/submit", (route) => {
    submissions++;
    return route.abort();
  });
  await complete(page);
  const button = page.getByRole("button", {
    name: "Get my estimate",
    exact: true,
  });
  await expect(button).toBeEnabled();
  const hidden = page.locator('input[name="xxTrustedFormCertUrl"]');
  await hidden.evaluate((input: HTMLInputElement) => {
    input.value = "";
  });
  await expect(button).toBeDisabled();
  await hidden.evaluate((input: HTMLInputElement) => {
    input.value = "https://example.com/invalid";
  });
  await expect(button).toBeDisabled();
  expect(submissions).toBe(0);
  await hidden.evaluate((input: HTMLInputElement, value: string) => {
    input.value = value;
  }, certificate);
  await expect(button).toBeEnabled();
  // SDK field changes can occur after polling but before the submit event.
  await page.evaluate(() => {
    const form = document.querySelector<HTMLFormElement>(
      'form[data-tf-element-role="offer"]',
    )!;
    form.querySelector<HTMLInputElement>(
      'input[name="xxTrustedFormCertUrl"]',
    )!.value = "";
    form.requestSubmit();
  });
  await expect(
    page.getByText(
      "Complete security and form verification before submitting.",
    ),
  ).toBeVisible();
  expect(submissions).toBe(0);
});

test("A lost response can be checked without a replacement security token", async ({
  page,
}) => {
  await page.route("https://challenges.cloudflare.com/**", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "let renders=0;window.turnstile={render(el,o){if(++renders===1)setTimeout(()=>o.callback('first-token'),10);return 'fixture'},remove(){}}",
    }),
  );
  let original: Record<string, unknown> | undefined;
  let attempts = 0;
  await page.route("**/modernize-test/submit", (route) => {
    const payload = route.request().postDataJSON();
    if (++attempts === 1) {
      original = payload;
      return route.abort();
    }
    expect(payload.requestId).toBe(original!.requestId);
    expect(payload.trustedFormToken).toBe(original!.trustedFormToken);
    expect(payload.turnstileToken).toBe("");
    return route.fulfill({
      json: {
        reference: "RZM-0123456789ABCDEF",
        status: "accepted",
        environment: "staging",
      },
    });
  });
  await complete(page);
  await page
    .getByRole("button", { name: "Get my estimate", exact: true })
    .click();
  const retry = page.getByRole("button", { name: "Check submission status" });
  await expect(retry).toBeEnabled();
  await retry.click();
  await expect(
    page.getByRole("heading", { name: "Your request is on its way." }),
  ).toBeVisible();
  expect(attempts).toBe(2);
});

for (const url of ["/", "/demo"]) {
  test(`Street-only addresses cannot advance in the Modernize property step: ${url}`, async ({
    page,
  }) => {
    await page.goto(url);
    await page.locator("#zip-start").fill("78209");
    await page
      .getByRole("button", {
        name: url === "/demo" ? "Start demo" : "Get my estimate",
        exact: true,
      })
      .click();
    await page.getByLabel("Roof repair", { exact: true }).check();
    await page
      .getByRole("combobox", { name: /What material/ })
      .selectOption("asphalt");
    await page
      .getByRole("combobox", { name: "When do you need help?", exact: true })
      .selectOption("Immediately");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    const address = page.getByLabel("Street address", { exact: true });
    await address.fill("Morning Star Street");
    await page.getByLabel("City", { exact: true }).fill("San Antonio");
    await page
      .getByRole("combobox", { name: "State", exact: true })
      .selectOption("TX");
    await page.getByLabel("I own this property").check();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(address).toBeVisible();
    await expect(
      page.getByText(/Enter the house or building number/),
    ).toBeVisible();
    await address.fill("123 Morning Star Street");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByLabel("First name", { exact: true })).toBeVisible();
  });
}

async function completeCertificateTest(page: Page) {
  await page.goto("/trustedform-test");
  await page.getByRole("button", { name: "Start sandbox recording" }).click();
  await page.getByLabel("Roof replacement", { exact: true }).check();
  await page
    .getByRole("combobox", { name: /What material/ })
    .selectOption("asphalt");
  await page
    .getByRole("combobox", { name: "When do you need help?", exact: true })
    .selectOption("Immediately");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByLabel("Street address", { exact: true })
    .fill("123 Example Lane");
  await page.getByLabel("City", { exact: true }).fill("San Antonio");
  await page
    .getByRole("combobox", { name: "State", exact: true })
    .selectOption("TX");
  await page.getByLabel("I own this property").check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("First name", { exact: true }).fill("Synthetic");
  await page.getByLabel("Last name", { exact: true }).fill("Homeowner");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("synthetic@example.com");
  await page.getByLabel("Phone number", { exact: true }).fill("2105550123");
  await page.getByLabel(/TEST ONLY: I acknowledge/).check();
}

test("Local certificate test is opt-in, sandbox-only and never delivers or stores a lead", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/trustedform-test");
  await expect(
    page.getByRole("button", { name: "Start sandbox recording" }),
  ).toBeVisible();
  expect(requests.some((url) => url.includes("api.trustedform.com"))).toBe(
    false,
  );
  await page.route("https://api.trustedform.com/**", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `const form=document.querySelector('form[data-tf-element-role="offer"]');const field=document.createElement('input');field.type='hidden';field.name='xxTrustedFormCertUrl';field.value='${certificate}';form.append(field);window.testStopped=false;window.trustedFormStopRecording=()=>{window.testStopped=true};`,
    }),
  );
  await completeCertificateTest(page);
  const scripts = requests.filter((url) => url.includes("api.trustedform.com"));
  expect(scripts).toHaveLength(1);
  expect(new URL(scripts[0]).searchParams.get("sandbox")).toBe("true");
  expect(
    await page.evaluate(() => Reflect.get(window, "funnelSubmitCount")),
  ).toBe(0);
  await page.getByRole("button", { name: "Finish certificate test" }).click();
  await expect(
    page.getByRole("link", { name: "Open test certificate" }),
  ).toHaveAttribute("href", certificate);
  await expect(page.locator('form[data-tf-element-role="offer"]')).toHaveCount(
    1,
  );
  await expect(page.locator('input[name="firstName"]')).toHaveCount(1);
  await expect(page.locator('input[name="lastName"]')).toHaveCount(1);
  const completion = page.getByRole("status").filter({
    hasText: "Sandbox certificate generated.",
  });
  await expect(completion).toBeFocused();
  await expect(completion).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Finish certificate test" }),
  ).toBeDisabled();
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "testStopped")))
    .toBe(true);
  expect(
    requests.filter((url) =>
      /modernize-test|quinstage|qnst\.com|firestore|zippopotam|challenges.cloudflare|maps.googleapis/.test(
        url,
      ),
    ),
  ).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect(
    await page.evaluate(() => Reflect.get(window, "funnelSubmitCount")),
  ).toBe(1);
});

test("Earlier steps validate and advance by keyboard without submitting, including reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/trustedform-test");
  await page.getByRole("button", { name: "Start sandbox recording" }).click();
  const next = page.getByRole("button", { name: "Continue", exact: true });
  await expect(next).toHaveAttribute("type", "button");
  await next.click();
  await expect(
    page.getByRole("heading", { name: "What does your roof need?" }),
  ).toBeVisible();
  await page.getByLabel("Roof replacement", { exact: true }).check();
  await page
    .getByRole("combobox", { name: /What material/ })
    .selectOption("asphalt");
  await page
    .getByRole("combobox", { name: "When do you need help?", exact: true })
    .selectOption("Immediately");
  await next.focus();
  await next.press("Enter");
  const street = page.getByLabel("Street address", { exact: true });
  await street.press("Enter");
  await expect(street).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Which home is it for?" }),
  ).toBeVisible();
  await street.fill("123 Example Lane");
  await page.getByLabel("City", { exact: true }).fill("San Antonio");
  await page
    .getByRole("combobox", { name: "State", exact: true })
    .selectOption("TX");
  await street.press("Enter");
  const authorized = page.getByLabel("I own this property");
  await expect(authorized).toBeFocused();
  await authorized.press("Space");
  await expect(authorized).toBeChecked();
  await street.dispatchEvent("keydown", { key: "Enter", isComposing: true });
  await street.dispatchEvent("keydown", { key: "Enter", repeat: true });
  await expect(street).toBeVisible();
  await street.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Where can we reach you?" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => Reflect.get(window, "funnelSubmitCount")),
  ).toBe(0);
  await page.getByLabel("First name", { exact: true }).fill("Synthetic");
  await page.getByLabel("Last name", { exact: true }).fill("Homeowner");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("synthetic@example.com");
  await page.getByLabel("Phone number", { exact: true }).fill("2105550123");
  await page.getByLabel(/TEST ONLY: I acknowledge/).check();
  await expect(
    page.getByRole("button", { name: "Finish certificate test" }),
  ).toBeEnabled();
  await page.getByLabel("Phone number", { exact: true }).press("Enter");
  await expect(
    page.getByRole("link", { name: "Open test certificate" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => Reflect.get(window, "funnelSubmitCount")),
  ).toBe(1);
});

test("Repeated same-task submit events cannot start two delivery requests", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/modernize-test/submit", async (route) => {
    requests++;
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({
      json: {
        reference: "RZM-0123456789ABCDEF",
        status: "accepted",
        environment: "staging",
      },
    });
  });
  await complete(page);
  await expect(
    page.getByRole("button", { name: "Get my estimate", exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => {
    const form = document.querySelector<HTMLFormElement>(
      'form[data-tf-element-role="offer"]',
    )!;
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(
    page.getByRole("heading", { name: "Your request is on its way." }),
  ).toBeVisible();
  expect(requests).toBe(1);
});

test("Validation failures keep recording available for a corrected submission", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/modernize-test/submit", (route) => {
    if (++attempts === 1)
      return route.fulfill({
        status: 422,
        json: { error: "Check the test details." },
      });
    return route.fulfill({
      json: {
        reference: "RZM-0123456789ABCDEF",
        status: "accepted",
        environment: "staging",
      },
    });
  });
  await complete(page);
  const finish = page.getByRole("button", {
    name: "Get my estimate",
    exact: true,
  });
  await finish.click();
  await expect(
    page.getByText("Check the test details.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("First name", { exact: true })).toBeEnabled();
  expect(await page.evaluate(() => Reflect.get(window, "testStopCount"))).toBe(
    0,
  );
  await expect(finish).toBeEnabled();
  await finish.click();
  await expect(
    page.getByRole("heading", { name: "Your request is on its way." }),
  ).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, "testStopCount"))).toBe(
    1,
  );
  expect(attempts).toBe(2);
});

test("Leaving a recording stops it and browser Forward requires a fresh document", async ({
  page,
}) => {
  let scripts = 0;
  page.on("request", (request) => {
    if (request.url().includes("api.trustedform.com")) scripts++;
  });
  await start(page);
  await expect(page.locator('[name="xxTrustedFormCertUrl"]')).toHaveValue(
    certificate,
  );
  expect(await page.evaluate(() => Reflect.get(window, "testStopCount"))).toBe(
    0,
  );
  await page.goBack();
  await expect(page.locator("#zip-start")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "testStopCount")))
    .toBe(1);
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Start a fresh form" }),
  ).toBeVisible();
  await expect(page.locator('form[data-tf-element-role="offer"]')).toHaveCount(
    0,
  );
  expect(scripts).toBe(1);
  await page.getByRole("button", { name: "Reload page" }).click();
  await expect(
    page.getByRole("heading", { name: "What does your roof need?" }),
  ).toBeVisible();
  await expect(page.locator('[name="xxTrustedFormCertUrl"]')).toHaveValue(
    certificate,
  );
  expect(scripts).toBe(2);
  expect(await page.evaluate(() => Reflect.get(window, "testStopCount"))).toBe(
    0,
  );
});

test("A late TrustedForm script is stopped after the form has been left", async ({
  page,
}) => {
  let release!: () => void;
  let requested!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const seen = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route("https://api.trustedform.com/**", async (route) => {
    requested();
    await held;
    await route.fulfill({
      contentType: "application/javascript",
      body: "window.testStopCount=0;window.trustedFormStopRecording=()=>window.testStopCount++;",
    });
  });
  await start(page);
  await seen;
  await page.goBack();
  await expect(page.locator("#zip-start")).toBeVisible();
  release();
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "testStopCount")))
    .toBe(1);
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Start a fresh form" }),
  ).toBeVisible();
});

test("Local certificate test blocks completion if the SDK fails", async ({
  page,
}) => {
  await page.route("https://api.trustedform.com/**", (route) => route.abort());
  await completeCertificateTest(page);
  await expect(
    page.getByText("Form verification could not load.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Finish certificate test" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("link", { name: "Open test certificate" }),
  ).toHaveCount(0);
});

test("Local certificate test rereads the hidden field at submission", async ({
  page,
}) => {
  await completeCertificateTest(page);
  await page.evaluate(() => {
    const form = document.querySelector<HTMLFormElement>(
      'form[data-tf-element-role="offer"]',
    )!;
    form.querySelector<HTMLInputElement>(
      'input[name="xxTrustedFormCertUrl"]',
    )!.value = "";
    form.requestSubmit();
  });
  await expect(
    page.getByText("No certificate is available. Reload and restart the test."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open test certificate" }),
  ).toHaveCount(0);
});
