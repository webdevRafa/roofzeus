import { test, expect, type Page } from "@playwright/test";
const turnstile = `window.turnstile={render(el,options){el.textContent='Security verified (test fixture)';setTimeout(()=>options.callback('synthetic-token'),10);return 'test-widget'},remove(){}};`;
const google = `window.google={maps:{importLibrary:async()=>({PlaceAutocompleteElement:class {constructor(){const el=document.createElement('div');const button=document.createElement('button');button.type='button';button.textContent='Choose example address';button.addEventListener('click',()=>{const event=new Event('gmp-select');event.placePrediction={toPlace:()=>({fetchFields:async()=>{},addressComponents:[{longText:'123',shortText:'123',types:['street_number']},{longText:'Example Lane',shortText:'Example Lane',types:['route']},{longText:'San Antonio',shortText:'San Antonio',types:['locality']},{longText:'Texas',shortText:'TX',types:['administrative_area_level_1']},{longText:'78209',shortText:'78209',types:['postal_code']}]})};el.dispatchEvent(event)});el.append(button);return el}}})}};`;
test.beforeEach(async ({ page }) => {
  await page.route("https://challenges.cloudflare.com/**", (route) =>
    route.fulfill({ contentType: "application/javascript", body: turnstile }),
  );
  await page.route("https://maps.googleapis.com/**", (route) => {
    const callback = new URL(route.request().url()).searchParams.get(
      "callback",
    );
    return route.fulfill({
      contentType: "application/javascript",
      // Reproduce Google's async bootstrap: the script load event precedes
      // importLibrary becoming available and the readiness callback firing.
      body: `window.google={maps:{}};setTimeout(()=>{${google};window[${JSON.stringify(callback)}]?.()},300);`,
    });
  });
  await page.route("https://api.zippopotam.us/us/**", (route) =>
    route.fulfill({
      json: {
        places: [{ "place name": "San Antonio", "state abbreviation": "TX" }],
      },
    }),
  );
});
async function completeToReview(page: Page) {
  await page.goto("/?zip=78209&estimate=1&service=roof-repair");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Choose example address" }).click();
  await expect(page.getByLabel("Street address", { exact: true })).toHaveValue(
    "123 Example Lane",
  );
  await page.getByLabel("I own this property").check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Full name").fill("Synthetic Homeowner");
  await page.getByLabel("Email address").fill("homeowner@example.com");
  await page.getByLabel("I agree that RoofZeus may contact me").check();
}

test("Homeowner flow retains details after failure and only confirms a saved request", async ({
  page,
}) => {
  let attempts = 0;
  let previousId = "";
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/test-intake", async (route) => {
    const payload = route.request().postDataJSON();
    expect(payload.consent).toBe(true);
    expect(payload.address).toBe("123 Example Lane");
    expect(payload.kind).toBe("homeowner");
    if (attempts++ === 0) {
      previousId = payload.requestId;
      await route.fulfill({
        status: 503,
        json: { error: "Temporary test outage. Please try again." },
      });
    } else {
      expect(payload.requestId).toBe(previousId);
      await route.fulfill({
        status: 201,
        json: { reference: "RZ-0123456789ABCDEF" },
      });
    }
  });
  await completeToReview(page);
  await page.getByRole("button", { name: "Get my estimate" }).click();
  await expect(page.getByRole("alert")).toContainText("Temporary test outage");
  await expect(page.getByLabel("Full name")).toHaveValue("Synthetic Homeowner");
  await page.getByRole("button", { name: "Get my estimate" }).click();
  await expect(
    page.getByRole("heading", { name: "You’re all set." }),
  ).toBeVisible();
  await expect(
    page.getByText("RZ-0123456789ABCDEF", { exact: true }),
  ).toBeVisible();
  expect(attempts).toBe(2);
  expect(errors).toEqual([]);
});
test("Invalid ZIP and missing service cannot advance; manual location survives lookup outage", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#zip-start").fill("12");
  await page
    .locator(".rz-estimate-hero")
    .getByRole("button", { name: "Get my estimate" })
    .click();
  await expect(page.getByRole("alert")).toContainText("5-digit");
  await page.goto("/find-a-roofer");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "What does your roof need?" }),
  ).toBeVisible();
  await page.getByLabel("Roof inspection", { exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.route("https://api.zippopotam.us/**", (route) => route.abort());
  await page.getByLabel("ZIP code", { exact: true }).fill("02108");
  await page
    .getByLabel("Street address", { exact: true })
    .fill("123 Test Street");
  await page.getByLabel("City", { exact: true }).fill("Boston");
  await page
    .getByRole("combobox", { name: "State", exact: true })
    .selectOption("MA");
  await page.getByLabel("I own this property").check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Where can we reach you?" }),
  ).toBeVisible();
});
test("Removed public contractor routes return home without contractor navigation", async ({
  page,
}) => {
  for (const path of ["/for-contractors", "/login", "/pricing", "/features"]) {
    await page.goto(path);
    await expect(page).toHaveURL("http://127.0.0.1:5174/");
    await expect(
      page.getByRole("link", { name: "For contractors", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Contractor login", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Register interest" }),
    ).toHaveCount(0);
  }
});

test("Public routes render without errors or horizontal overflow on desktop and mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/",
      "/services",
      "/services/roof-repair",
      "/how-it-works",
      "/guides",
      "/guides/choosing-a-roofer",
      "/locations",
      "/roofers/tx/san-antonio",
      "/for-contractors",
      "/faq",
      "/privacy",
      "/terms",
      "/find-a-roofer",
      "/does-not-exist",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toHaveCount(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `${path} at ${width}`,
      ).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});
test("Landing page has one clear funnel and remembers ZIP without extra navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("header nav")).toHaveCount(0);
  await expect(page.getByText("Homeowner guides", { exact: true })).toHaveCount(
    0,
  );
  await page.locator("#zip-start").fill("78209");
  await page
    .getByRole("button", { name: "Get my estimate", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "What does your roof need?" }),
  ).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.locator("#zip-start")).toHaveValue("78209");
  await page.goto("/guides/choosing-a-roofer");
  await expect(page.locator("h1")).toContainText("estimate");
});

test("App host still opens the existing contractor login", async ({ page }) => {
  await page.goto("http://app.localhost:5174/login");
  await expect(page.locator(".rz-public")).toHaveCount(0);
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  expect(await page.title()).toContain("Contractor");
});

test("Google address search waits for SDK readiness and reuses it after switching entry modes", async ({
  page,
}) => {
  let loads = 0;
  page.on("request", (request) => {
    if (request.url().startsWith("https://maps.googleapis.com/maps/api/js?"))
      loads++;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Full address", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Choose example address" }),
  ).toBeVisible();
  await expect(
    page.getByText("Address search is unavailable.", { exact: false }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "ZIP code", exact: true }).click();
  await page.getByRole("button", { name: "Full address", exact: true }).click();
  await page.getByRole("button", { name: "Choose example address" }).click();
  await expect(page.getByLabel("Street address", { exact: true })).toHaveValue(
    "123 Example Lane",
  );
  expect(loads).toBe(1);
});

test("Full address starts the funnel with Google details and keeps them out of browser storage and URLs", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Full address", exact: true }).click();
  await page.getByRole("button", { name: "Choose example address" }).click();
  await expect(page.getByLabel("Street address", { exact: true })).toHaveValue(
    "123 Example Lane",
  );
  await page.getByRole("button", { name: "Get my estimate" }).click();
  await page.getByLabel("Roof repair", { exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Street address", { exact: true })).toHaveValue(
    "123 Example Lane",
  );
  await expect(page.getByLabel("City", { exact: true })).toHaveValue(
    "San Antonio",
  );
  await expect(
    page.getByRole("combobox", { name: "State", exact: true }),
  ).toHaveValue("TX");
  await expect(page.getByLabel("ZIP code", { exact: true })).toHaveValue(
    "78209",
  );
  expect(new URL(page.url()).search).toBe("?zip=78209&estimate=1");
  const storage = await page.evaluate(() =>
    JSON.stringify([localStorage, sessionStorage]),
  );
  expect(storage).not.toContain("Example Lane");
  expect(storage).not.toContain("San Antonio");
  await page.getByLabel("I own this property").check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Where can we reach you?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.locator("#zip-start").fill("02108");
  await page.getByRole("button", { name: "Get my estimate" }).click();
  await page.getByLabel("Roof repair", { exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Street address", { exact: true })).toHaveValue(
    "",
  );
});

test("Manual full address works during Google outage, validates required details, and fits small screens", async ({
  page,
}) => {
  await page.route("https://maps.googleapis.com/**", (route) => route.abort());
  await page.route("https://api.zippopotam.us/**", (route) => route.abort());
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Full address", exact: true }).click();
  await page.getByRole("button", { name: "Get my estimate" }).click();
  await expect(
    page.getByLabel("Street address", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Street address", { exact: true })
    .fill("123 Test Street");
  await page.getByLabel("City", { exact: true }).fill("Boston");
  await page
    .getByRole("combobox", { name: "State", exact: true })
    .selectOption("MA");
  await page.getByLabel("ZIP code", { exact: true }).fill("021");
  await page.getByRole("button", { name: "Get my estimate" }).click();
  await expect(
    page.getByLabel("Street address", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("ZIP code", { exact: true }).fill("02108");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Get my estimate" }).click();
  await page.getByLabel("Roof inspection", { exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Street address", { exact: true })).toHaveValue(
    "123 Test Street",
  );
  await expect(page.getByLabel("City", { exact: true })).toHaveValue("Boston");
  await expect(
    page.getByRole("combobox", { name: "State", exact: true }),
  ).toHaveValue("MA");
  await expect(page.getByLabel("ZIP code", { exact: true })).toHaveValue(
    "02108",
  );
});

test("Google street-only results require a property number in entry and manual property steps", async ({
  page,
}) => {
  await page.route("https://maps.googleapis.com/**", (route) => {
    const callback = new URL(route.request().url()).searchParams.get(
      "callback",
    );
    const streetOnly = google.replace(
      "{longText:'123',shortText:'123',types:['street_number']},",
      "",
    );
    return route.fulfill({
      contentType: "application/javascript",
      body: `${streetOnly};window[${JSON.stringify(callback)}]?.();`,
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Full address", exact: true }).click();
  await page.getByRole("button", { name: "Choose example address" }).click();
  const address = page.getByLabel("Street address", { exact: true });
  await expect(address).toHaveValue("Example Lane");
  await expect(
    page.getByText(/Enter the house or building number/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Get my estimate", exact: true })
    .click();
  await expect(address).toBeVisible();
  await address.fill("123 Example Lane");
  await page
    .getByRole("button", { name: "Get my estimate", exact: true })
    .click();
  await page.getByLabel("Roof repair", { exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Choose example address" }).click();
  await page.getByLabel("I own this property").check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(address).toBeVisible();
  await address.fill("123 Example Lane");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Where can we reach you?" }),
  ).toBeVisible();
});
