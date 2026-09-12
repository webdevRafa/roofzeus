import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

// Animate one persistent form; never duplicate fields or consent-capture nodes.
export function useFunnelStep() {
  const [step, updateStep] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const motionRef = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const animation = useRef<Animation | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      animation.current?.cancel();
    };
  }, []);

  async function setStep(next: number) {
    if (inFlight.current || next === step) return;
    const element = motionRef.current;
    if (
      !element ||
      !element.animate ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      updateStep(next);
      return;
    }
    inFlight.current = true;
    setTransitioning(true);
    const direction = next > step ? 1 : -1;
    try {
      animation.current = element.animate(
        [
          { opacity: 1, transform: "translateX(0)" },
          { opacity: 0, transform: `translateX(${-direction * 18}px)` },
        ],
        { duration: 120, easing: "ease-in", fill: "forwards" },
      );
      await animation.current.finished;
      if (!mounted.current) return;
      flushSync(() => updateStep(next));
      animation.current.cancel();
      animation.current = element.animate(
        [
          { opacity: 0, transform: `translateX(${direction * 18}px)` },
          { opacity: 1, transform: "translateX(0)" },
        ],
        { duration: 180, easing: "cubic-bezier(.2,.7,.2,1)", fill: "both" },
      );
      await animation.current.finished;
    } catch {
      // Cancellation on unmount is expected.
    } finally {
      animation.current?.cancel();
      inFlight.current = false;
      if (mounted.current) setTransitioning(false);
    }
  }
  return { step, setStep, transitioning, motionRef };
}

export function revealFunnelStep() {
  const panel = document.getElementById("estimate-funnel");
  if (!panel) return;
  panel.scrollTop = 0;
  // Keep the document still when the desktop form is already in view.
  const rect = panel.getBoundingClientRect();
  if (rect.top < 0 || rect.top > window.innerHeight * 0.65)
    panel.scrollIntoView({ block: "start", behavior: "instant" });
}
