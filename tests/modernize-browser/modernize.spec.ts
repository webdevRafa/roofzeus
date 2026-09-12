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
  await expect(page.getByLabel("City", { exact: true })).toHaveValue("San Antonio");
  await expect(page.getByRole("combobox", { name: "State", exact: true })).toHaveValue("TX");
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
  await expect(page.locator("#modernize-phone-error")).toContainText("Letters");
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
  await expect(page.locator("#modernize-phone-error")).toContainText(
    "10 digits",
  );
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
