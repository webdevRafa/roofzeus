import { useEffect, useState } from "react";
import { lookupZip } from "./integrations";

export default function AreaLabel({
  demo,
  propertyZip = "",
}: {
  demo: boolean;
  propertyZip?: string;
}) {
  const [area, setArea] = useState<string | null>(null);
  const [zipArea, setZipArea] = useState<{ zip: string; label: string } | null>(
    null,
  );
  // An entered property location takes precedence over approximate IP location.
  // While editing or if lookup fails, never keep showing the previous ZIP's city.
  const displayArea = propertyZip
    ? zipArea?.zip === propertyZip
      ? zipArea.label
      : null
    : area;
  useEffect(() => {
    if (demo || !/^\d{5}$/.test(propertyZip)) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4000);
    const timer = window.setTimeout(() => {
      lookupZip(propertyZip, controller.signal)
        .then((place) => {
          if (
            !controller.signal.aborted &&
            place &&
            typeof place.city === "string" &&
            /^[\p{L}\p{M} .'-]{1,80}$/u.test(place.city) &&
            /^[A-Z]{2}$/.test(place.state)
          )
            setZipArea({
              zip: propertyZip,
              label: `${place.city}, ${place.state}`,
            });
        })
        .catch(() => {})
        .finally(() => window.clearTimeout(timeout));
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      window.clearTimeout(timeout);
    };
  }, [demo, propertyZip]);
  const [checking, setChecking] = useState(!demo);
  const [fadingOut, setFadingOut] = useState(false);
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    let active = true;
    let reveal: number | undefined;
    const started = performance.now();
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
      .finally(() => {
        window.clearTimeout(timeout);
        if (!active) return;
        // Avoid a flash of loading text on fast responses without delaying input.
        reveal = window.setTimeout(
          () => {
            if (!active) return;
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
              setChecking(false);
            } else {
              setFadingOut(true);
            }
          },
          Math.max(0, 2800 - (performance.now() - started)),
        );
      });
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
      window.clearTimeout(reveal);
    };
  }, [demo]);
  return (
    <div
      className="rz-area-banner-content"
      title={
        displayArea
          ? propertyZip
            ? "Area associated with your property ZIP. Availability is not yet confirmed."
            : "Approximate area. Enter your property ZIP or address to confirm its location."
          : undefined
      }
    >
      <span className="rz-area-size" aria-hidden="true">
        Explore roofing estimates{" "}
        {displayArea && !demo ? `near ${displayArea}` : "in your area"}
      </span>
      <h2
        aria-live="polite"
        aria-atomic="true"
        className={
          demo
            ? "rz-area-result"
            : checking
              ? fadingOut
                ? "rz-area-fade-out"
                : undefined
              : "rz-area-result rz-area-fade-in"
        }
        onAnimationEnd={(event) => {
          // Ignore the animated dots bubbling up from inside this heading.
          if (
            event.target === event.currentTarget &&
            event.animationName === "rz-area-fade-out"
          ) {
            setChecking(false);
          }
        }}
      >
        {checking && !demo ? (
          <>
            Checking your area
            <span className="rz-area-dots" aria-hidden="true">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </>
        ) : (
          <>
            Explore roofing estimates{" "}
            {displayArea && !demo ? `near ${displayArea}` : "in your area"}
          </>
        )}
      </h2>
    </div>
  );
}
