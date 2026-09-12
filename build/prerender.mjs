import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  render,
  pages,
  SITE_URL,
  structuredData,
} from "../dist-ssr/entry-public-server.js";
const template = await readFile("dist/index.html", "utf8");
if (!template.includes('<div id="root"></div>'))
  throw new Error(
    "Run the full build before prerendering; the client template must be fresh.",
  );
const escape = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
await writeFile(
  "dist/app.html",
  template
    .replace('content="index,follow"', 'content="noindex,nofollow"')
    .replace(/<link\s+rel="canonical"[^>]*>/, "")
    .replace(
      "</head>",
      '<link rel="stylesheet" href="https://use.typekit.net/kcv7vge.css" /><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700&display=swap" rel="stylesheet" /></head>',
    ),
);
for (const page of pages) {
  const url = `${SITE_URL}${page.path}`;
  let html = template
    .replace(
      '<div id="root"></div>',
      `<div id="root" data-prerender="${page.path}">${render(page.path)}</div>`,
    )
    .replace(/<title>.*?<\/title>/, `<title>${escape(page.title)}</title>`)
    .replace(
      /(<meta\s+name="description"\s+content=")[^"]*/,
      `$1${escape(page.description)}`,
    )
    .replace(
      /(<meta\s+name="robots"\s+content=")[^"]*/,
      `$1${page.index === false ? "noindex,follow" : "index,follow"}`,
    )
    .replace(/(<link\s+rel="canonical"\s+href=")[^"]*/, `$1${url}`)
    .replace(
      /(<meta\s+property="og:title"\s+content=")[^"]*/,
      `$1${escape(page.title)}`,
    )
    .replace(
      /(<meta\s+property="og:description"\s+content=")[^"]*/,
      `$1${escape(page.description)}`,
    )
    .replace(/(<meta\s+property="og:url"\s+content=")[^"]*/, `$1${url}`);
  const schema = structuredData(page);
  html = html.replace(
    "</head>",
    `<script type="application/ld+json">${JSON.stringify(schema).replaceAll("<", "\\u003c")}</script></head>`,
  );
  const file = page.path === "/" ? "dist/index.html" : `dist${page.path}.html`;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html);
}
const indexed = pages.filter((p) => p.index !== false);
await writeFile(
  "dist/sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${indexed.map((p) => `<url><loc>${SITE_URL}${p.path}</loc></url>`).join("")}</urlset>`,
);
await writeFile(
  "dist/robots.txt",
  `User-agent: *\nAllow: /\nDisallow: /brand/\nSitemap: ${SITE_URL}/sitemap.xml\n`,
);
console.log(
  `Prerendered ${pages.length} public pages; ${indexed.length} indexable URLs in sitemap. San Antonio remains noindex until coverage/editorial approval.`,
);
