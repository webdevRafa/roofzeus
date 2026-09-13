import { useEffect, useState } from "react";

export default function AreaLabel({ demo }: { demo: boolean }) {
  const [area, setArea] = useState<string | null>(null);
  const [checking, setChecking] = useState(!demo);
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
            if (active) setChecking(false);
          },
          Math.max(0, 800 - (performance.now() - started)),
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
        area
          ? "Approximate area. Enter your property ZIP or address to confirm its location."
          : undefined
      }
    >
      <h2 aria-live="polite" aria-atomic="true">
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
            {area && !demo ? `near ${area}` : "in your area"}
          </>
        )}
      </h2>
    </div>
  );
}
