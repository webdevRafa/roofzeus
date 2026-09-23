import {
  attributionKeys,
  sanitizeAttribution,
} from "../../functions/src/lead-attribution";
export type { LeadAttribution } from "../../functions/src/lead-attribution";

export function captureAttribution(
  pathname: string,
  search: string,
  demo: boolean,
) {
  if (demo) return undefined;
  const params = new URLSearchParams(search);
  return sanitizeAttribution({
    landingPath: pathname,
    ...Object.fromEntries(attributionKeys.map((key) => [key, params.get(key)])),
  });
}

// Vercel pageviews should never receive ZIPs, form state or arbitrary URL values.
export function analyticsBeforeSend<T extends { url: string }>(
  event: T,
): T | null {
  const url = new URL(event.url);
  if (
    url.pathname === "/demo" ||
    url.pathname === "/partner-preview" ||
    url.searchParams.get("preview") === "1"
  )
    return null;
  url.search = "";
  url.hash = "";
  return { ...event, url: url.toString() };
}
