import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pages } from "../dist-ssr/entry-public-server.js";
test("Every public route has HTML content, one H1, unique metadata, and a canonical URL", async () => {
  const titles = new Set();
  for (const page of pages) {
    const html = await readFile(
      page.path === "/" ? "dist/index.html" : `dist${page.path}.html`,
      "utf8",
    );
    assert.equal((html.match(/<h1[ >]/g) || []).length, 1, page.path);
    assert.ok(html.includes(`data-prerender="${page.path}"`));
    assert.ok(html.includes(`href="https://roofzeus.com${page.path}"`));
    assert.ok(html.includes("application/ld+json"));
    const description = html.match(
      /<meta\s+name="description"\s+content="([^"]*)"/,
    )[1];
    const escapedDescription = page.description
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
    assert.equal(
      description,
      escapedDescription,
      `description for ${page.path}`,
    );
    assert.equal(
      html.includes('content="noindex,follow"'),
      page.index === false,
      page.path,
    );
    const title = html.match(/<title>(.*?)<\/title>/)[1];
    assert.ok(!titles.has(title));
    titles.add(title);
  }
});
test("Sitemap contains only the estimate landing page", async () => {
  const xml = await readFile("dist/sitemap.xml", "utf8");
  for (const p of pages)
    assert.equal(
      xml.includes(`<loc>https://roofzeus.com${p.path}</loc>`),
      p.index !== false,
      p.path,
    );
  assert.ok(!xml.includes("/roofers/tx/san-antonio"));
  assert.equal((xml.match(/<loc>/g) || []).length, 1);
});
test("Contractor SPA document does not contain public marketing and is not indexable", async () => {
  const html = await readFile("dist/app.html", "utf8");
  assert.ok(html.includes('<div id="root"></div>'));
  assert.ok(html.includes("noindex,nofollow"));
  assert.ok(!html.includes("data-prerender"));
  assert.ok(html.includes("use.typekit.net"));
});
test("PII database is separate and denies every client access", async () => {
  const config = JSON.parse(await readFile("firebase.json", "utf8"));
  assert.deepEqual(config.firestore, [
    { database: "roofzeus-leads", rules: "firestore.leads.rules" },
  ]);
  assert.ok(
    (await readFile("firestore.leads.rules", "utf8")).includes(
      "allow read, write: if false",
    ),
  );
});
test("App host rewrites use clean destinations and exclude public assets", async () => {
  const config = JSON.parse(await readFile("vercel.json", "utf8"));
  assert.equal(config.cleanUrls, true);
  for (const host of [
    "app.roofzeus.com",
    "signup.roofzeus.com",
    "app.roofzeus.vercel.app",
  ]) {
    const rule = config.rewrites.find((r) =>
      r.has?.some((h) => h.type === "host" && h.value === host),
    );
    assert.equal(rule.destination, "/app");
    const matcher = new RegExp("^" + rule.source.replace(":path", "") + "$");
    assert.ok(matcher.test("/jobs"));
    assert.ok(matcher.test("/job/example-id"));
    assert.ok(!matcher.test("/assets/example.js"));
    assert.ok(!matcher.test("/brand/roof-zeus-emblem.png"));
  }
});
