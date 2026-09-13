// Vercel supplies approximate location headers. Never return an IP address or
// coordinates, persist the location, or use it for lead eligibility/routing.
export function GET(request) {
  let area = null;
  try {
    const country = request.headers.get("x-vercel-ip-country");
    const region = request.headers.get("x-vercel-ip-country-region") || "";
    const city = decodeURIComponent(
      request.headers.get("x-vercel-ip-city") || "",
    ).trim();
    if (
      country === "US" &&
      /^[A-Z]{2}$/.test(region) &&
      city.length > 0 &&
      city.length <= 80 &&
      /^[\p{L}\p{M} .'-]+$/u.test(city)
    ) {
      area = `${city}, ${region}`;
    }
  } catch {
    // Missing or malformed geolocation is ordinary: keep the generic label.
  }
  return Response.json(
    { area },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "CDN-Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}
