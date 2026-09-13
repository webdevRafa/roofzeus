import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";

export default function AreaLabel({ demo }: { demo: boolean }) {
  const [area, setArea] = useState<string | null>(null);
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 3000);
    void fetch("/api/visitor-area", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (
          !controller.signal.aborted &&
          typeof data?.area === "string" &&
          data.area.length <= 84 &&
          /^[\p{L}\p{M} .'-]+, [A-Z]{2}$/u.test(data.area)
        ) {
          setArea(data.area);
        }
      })
      .catch(() => {
        /* The generic label remains useful if lookup fails. */
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [demo]);
  return (
    <div
      className="rz-area-banner-content"
      title={
        area
          ? "Approximate area. Enter your property ZIP or address to confirm its location."
          : undefined
      }
    >
      <span className="rz-area-banner-icon" aria-hidden="true">
        <MapPin size={22} />
      </span>
      <h2>
        Explore roofing estimates{" "}
        <span>{area && !demo ? `near ${area}` : "in your area"}</span>
      </h2>
    </div>
  );
}
