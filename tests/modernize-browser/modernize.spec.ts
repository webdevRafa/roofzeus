import { test, expect, type Page } from "@playwright/test";
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
  trustedFormScriptUrl:
    "https://api.trustedform.com/trustedform.js?field=xxTrustedFormCertUrl&use_tagged_consent=true&sandbox=true",
  materials: ["asphalt", "metal"],
  affiliateUrl: "",
};
test.beforeEach(async ({ page }) => {
  await page.route("**/modernize-test/config", (route) =>
    route.fulfill({ json: config }),
  );
  await page.route("https://api.trustedform.com/**", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `const form=document.querySelector('form[data-tf-element-role="offer"]');if(!form)throw Error('Form must exist first');const field=document.createElement('input');field.type='hidden';field.name='xxTrustedFormCertUrl';field.value='${certificate}';form.append(field);`,
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
async function start(page: Page, address = false) {
  await page.goto("/");
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
    .getByRole("button", { name: "Get my estimate", exact: true })
    .click();
}
async function complete(page: Page) {
  await start(page, true);
  await page.getByLabel("Roof replacement", { exact: true }).check();
  await page
    .getByRole("combobox", { name: "Roof material", exact: true })
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
  await page.getByLabel(consent, { exact: true }).check();
}
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
  expect(page.url()).not.toContain("Example");
  await expect(
    page.locator('[data-tf-element-role="consent-language"]'),
  ).toHaveText(consent);
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
  await page.getByRole("button", { name: "Check submission status" }).click();
  await expect(
    page.getByRole("heading", { name: "We’re checking your request." }),
  ).toBeVisible();
  await expect(
    page.getByText("Your request is on its way.", { exact: true }),
  ).toHaveCount(0);
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
    .getByRole("combobox", { name: "Roof material", exact: true })
    .selectOption("asphalt");
  await page
    .getByRole("combobox", { name: "When do you need help?", exact: true })
    .selectOption("Immediately");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByLabel("Street address", { exact: true })
    .fill("123 Example Lane");
  await page.getByLabel("I own this property").check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Get my estimate", exact: true }),
  ).toBeDisabled();
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
test("Unsupported answers cannot advance and both entry modes fit desktop and mobile", async ({
  page,
}) => {
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
  await page.getByLabel("Inspection / not sure", { exact: true }).check();
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("status")).toContainText(
    "won’t submit an assumed answer",
  );
});
