export type ZipLocation = { zip: string; city: string; state: string };
export async function lookupZip(
  zip: string,
  signal?: AbortSignal,
): Promise<ZipLocation | null> {
  if (!/^\d{5}$/.test(zip)) return null;
  const response = await fetch(`https://api.zippopotam.us/us/${zip}`, {
    signal: signal ?? AbortSignal.timeout(6000),
  });
  if (!response.ok) return null;
  const data = await response.json();
  const place = data.places?.[0];
  return place
    ? { zip, city: place["place name"], state: place["state abbreviation"] }
    : null;
}
export function contractorUrl(path = "/login") {
  if (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "app.localhost"].includes(
      window.location.hostname,
    )
  )
    return `http://app.localhost:${window.location.port || "5173"}${path}`;
  return `https://app.roofzeus.com${path}`;
}
const scripts = new Map<string, Promise<void>>();
export function loadScript(src: string): Promise<void> {
  const existing = scripts.get(src);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    const timer = setTimeout(() => {
      scripts.delete(src);
      script.remove();
      reject(new Error("Loading timed out"));
    }, 15000);
    script.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timer);
      scripts.delete(src);
      script.remove();
      reject(new Error("Could not load service"));
    };
    document.head.append(script);
  });
  scripts.set(src, promise);
  return promise;
}
export const intakeConfigured = Boolean(
  import.meta.env.VITE_PUBLIC_INTAKE_URL &&
  import.meta.env.VITE_TURNSTILE_SITE_KEY,
);
export async function submitIntake(
  payload: unknown,
): Promise<{ reference: string }> {
  const url = import.meta.env.VITE_PUBLIC_INTAKE_URL;
  if (!url)
    throw new Error(
      "Online requests are not open yet. Please check back soon. Your request has not been sent.",
    );
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      result.error || "We could not confirm your request. Please try again.",
    );
  if (typeof result.reference !== "string")
    throw new Error("We could not confirm your request. Please try again.");
  return result;
}
// Deliberately contains no names, contact details, addresses, or query strings.
export function track(
  name: string,
  attributes: Record<string, string | number> = {},
) {
  window.dispatchEvent(
    new CustomEvent("roofzeus:analytics", { detail: { name, ...attributes } }),
  );
}
