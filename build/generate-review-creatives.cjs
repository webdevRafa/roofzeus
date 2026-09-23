// Optional asset-authoring tool. Pass an installed sharp module path as argv[2].
// Production builds consume the committed SVG/PNG/WebP files, not this script.
const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require(process.argv[2] || "sharp");
const root = path.resolve(__dirname, "..");
const out = path.join(root, "public/creatives");
const escape = (value) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
async function main() {
  await fs.mkdir(out, { recursive: true });
  const logo = `data:image/svg+xml;base64,${(await fs.readFile(path.join(root, "public/brand/v8/logo-dark.svg"))).toString("base64")}`;
  const concepts = [
    {
      id: "general-01",
      image: "roof-home.webp",
      lines: ["Roof on", "your mind?"],
      subtitle: "Repair or replacement. Start here.",
      url: "roofzeus.com",
      destination: "/",
    },
    {
      id: "replacement-01",
      image: "roof-replacement.webp",
      lines: ["Thinking about", "a new roof?"],
      subtitle: "Your home. Your timing. Your next step.",
      url: "roofzeus.com/roof-replacement",
      destination: "/roof-replacement",
    },
    {
      id: "repair-01",
      image: "roof-repair.webp",
      lines: ["A roof problem.", "A next step."],
      subtitle: "Explore your roof repair options.",
      url: "roofzeus.com/roof-repair",
      destination: "/roof-repair",
    },
  ];
  for (const concept of concepts) {
    const photo = `data:image/jpeg;base64,${(
      await sharp(path.join(root, "public/images", concept.image))
        .jpeg({ quality: 90 })
        .toBuffer()
    ).toString("base64")}`;
    for (const [format, height, photoY, photoH, textY] of [
      ["square", 1080, 206, 380, 686],
      ["feed", 1350, 216, 560, 883],
      ["story", 1920, 420, 580, 1130],
    ]) {
      const footer = format === "story" ? 1640 : height - 48;
      const top = format === "story" ? 270 : 48;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="${height}" viewBox="0 0 1080 ${height}"><defs><clipPath id="photo"><rect x="56" y="${photoY}" width="968" height="${photoH}" rx="4"/></clipPath></defs><rect width="1080" height="${height}" fill="#081827"/><image x="56" y="${top}" width="340" height="114" xlink:href="${logo}"/><text x="1024" y="${top + 57}" text-anchor="end" font-family="Arial,sans-serif" font-size="20" fill="#e7bf72" letter-spacing="3">YOUR HOME. YOUR CHOICE.</text><image x="56" y="${photoY}" width="968" height="${photoH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#photo)" xlink:href="${photo}"/><rect x="56" y="${photoY + photoH - 4}" width="968" height="4" fill="#d6ac58"/><g font-family="Arial,sans-serif"><text x="56" y="${textY}" fill="#ffffff" font-size="78" font-weight="700" letter-spacing="-3">${escape(concept.lines[0])}</text><text x="56" y="${textY + 87}" fill="#e7bf72" font-size="78" font-weight="700" letter-spacing="-3">${escape(concept.lines[1])}</text><text x="56" y="${textY + 143}" fill="#d3dde4" font-size="28">${escape(concept.subtitle)}</text><rect x="56" y="${textY + 181}" width="398" height="66" rx="3" fill="#d6ac58"/><text x="82" y="${textY + 224}" fill="#081827" font-size="25" font-weight="700">Explore roofing estimates →</text><text x="56" y="${footer - 36}" fill="#d3dde4" font-size="21">No obligation to hire. Availability varies.</text><text x="56" y="${footer}" fill="#ffffff" font-size="22">${concept.url}</text><text x="1024" y="${footer}" text-anchor="end" fill="#aab9c4" font-size="15">ILLUSTRATIVE IMAGE</text></g></svg>`;
      const base = path.join(out, `${concept.id}-${format}`);
      await fs.writeFile(base + ".svg", svg);
      await sharp(Buffer.from(svg))
        .png({ compressionLevel: 9 })
        .toFile(base + ".png");
      if (format === "square")
        await sharp(Buffer.from(svg))
          .resize(720, 720)
          .webp({ quality: 86 })
          .toFile(base + ".webp");
    }
  }
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
