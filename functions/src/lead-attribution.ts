// Shared by the browser and gateway. Never accept arbitrary URLs, query strings,
// contact values, or ad-platform click identifiers into attribution records.
export const landingPaths = ["/", "/roof-repair", "/roof-replacement"] as const;
export type LeadAttribution = {
  landingPath: string;
  variant: "general" | "repair" | "replacement";
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  creative_id?: string;
};
export const attributionKeys = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "creative_id",
] as const;
export function sanitizeAttribution(
  input: unknown,
): LeadAttribution | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return;
  const data = input as Record<string, unknown>;
  if (!landingPaths.some((path) => path === data.landingPath)) return;
  const landingPath = data.landingPath as string;
  const clean: LeadAttribution = {
    landingPath,
    variant:
      landingPath === "/roof-repair"
        ? "repair"
        : landingPath === "/roof-replacement"
          ? "replacement"
          : "general",
  };
  for (const key of attributionKeys) {
    const value = data[key];
    // Campaign slugs only; reject free text, emails, phone-shaped IDs and URLs.
    if (
      typeof value === "string" &&
      /^[a-z][a-z0-9_-]{0,63}$/i.test(value) &&
      !/\d{7}/.test(value)
    )
      clean[key] = value;
  }
  return clean;
}
