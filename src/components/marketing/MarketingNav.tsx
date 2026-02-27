// src/components/marketing/MarketingNav.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { Menu, X, ArrowRight, LogIn, ChevronDown, Scale } from "lucide-react";

import logo from "../../assets/roofzeus-white.png";

type NavItem = {
  label: string;
  to: string;
};

const ease = [0.16, 1, 0.3, 1] as const;

const overlayIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.18, ease } },
  exit: { opacity: 0, transition: { duration: 0.15, ease } },
};

const drawerIn: Variants = {
  hidden: { x: 14, opacity: 0, filter: "blur(6px)" },
  show: {
    x: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: { duration: 0.22, ease },
  },
  exit: {
    x: 14,
    opacity: 0,
    filter: "blur(6px)",
    transition: { duration: 0.18, ease },
  },
};

const popIn: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.98, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.18, ease },
  },
  exit: {
    opacity: 0,
    y: 8,
    scale: 0.98,
    filter: "blur(6px)",
    transition: { duration: 0.15, ease },
  },
};

const TRIAL_CTA_SESSION_KEY = "rz_trial_cta_revealed_v1";
const TRIAL_CTA_REVEAL_SCROLL_Y = 420; // px scrolled before CTA appears

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function MarketingNav() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const legalWrapRef = useRef<HTMLDivElement | null>(null);

  // ✅ Reveal navbar CTA after scroll, then persist for the rest of the tab session.
  const [trialCtaRevealed, setTrialCtaRevealed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(TRIAL_CTA_SESSION_KEY) === "1";
    } catch {
      return false;
    }
  });

  // Primary nav: only the important top-level destinations
  const items = useMemo<NavItem[]>(
    () => [
      { label: "Home", to: "/" },
      { label: "Pricing", to: "/pricing" },
      { label: "FAQ", to: "/faq" }, // change to "/faqs" only if that's your actual route
    ],
    []
  );

  // Legal stays out of the main row (cleaner on mid widths)
  const legalItems = useMemo<NavItem[]>(
    () => [
      { label: "Privacy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
    ],
    []
  );

  // Close menus on route change
  useEffect(() => {
    setOpen(false);
    setLegalOpen(false);
  }, [location.pathname]);

  // Lock scroll when mobile menu is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setLegalOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Click outside closes Legal dropdown
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!legalOpen) return;
      const el = legalWrapRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setLegalOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [legalOpen]);

  // Reveal CTA after user scrolls a bit; once revealed it never hides again this session.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (trialCtaRevealed) return;

    let raf = 0;

    const check = () => {
      // Only care until it flips to revealed
      if (window.scrollY >= TRIAL_CTA_REVEAL_SCROLL_Y) {
        try {
          sessionStorage.setItem(TRIAL_CTA_SESSION_KEY, "1");
        } catch {
          // ignore
        }
        setTrialCtaRevealed(true);
      }
    };

    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        check();
      });
    };

    // Run once in case the user lands mid-page (or refreshes after scroll)
    check();

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [trialCtaRevealed]);

  return (
    <>
      <header className="sticky top-0 z-50">
        {/* background + blur */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="h-full w-full bg-[#0b0e14]/70 backdrop-blur-xl" />
        </div>

        {/* slightly tighter overall; avoid huge max width causing the nav to feel “floating” */}
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-3">
            {/* Brand */}
            <Link
              to="/"
              className="group inline-flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-white/5 transition"
              aria-label="ROOFZEUS Home"
            >
              <img
                src={logo}
                alt="ROOFZEUS"
                className="h-6 w-auto select-none "
                draggable={false}
              />
            </Link>

            {/* Desktop Nav: ONLY at lg+ to avoid the awkward md-to-lg crowding */}
            <nav className="hidden lg:flex items-center gap-1">
              {items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  className={({ isActive }) =>
                    cx(
                      "relative rounded-xl px-3 py-2 text-sm transition",
                      "hover:bg-white/5",
                      isActive ? "text-[#f5f6f8]" : "text-white/65"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className="relative z-10">{it.label}</span>
                      {isActive && (
                        <motion.span
                          layoutId="mk-nav-active"
                          className="absolute inset-0 rounded-xl bg-white/5 ring-1 ring-white/10"
                          transition={{ duration: 0.25, ease }}
                        />
                      )}
                    </>
                  )}
                </NavLink>
              ))}

              {/* Legal dropdown */}
              <div ref={legalWrapRef} className="relative ml-1">
                <button
                  type="button"
                  onClick={() => setLegalOpen((v) => !v)}
                  className={cx(
                    "relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                    "text-white/65 hover:bg-white/5 hover:text-white/80"
                  )}
                  aria-haspopup="menu"
                  aria-expanded={legalOpen}
                >
                  <Scale className="h-4 w-4 text-white/55" />
                  Legal
                  <ChevronDown
                    className={cx(
                      "h-4 w-4 text-white/55 transition",
                      legalOpen && "rotate-180"
                    )}
                  />
                </button>

                <AnimatePresence>
                  {legalOpen && (
                    <motion.div
                      variants={popIn}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                      className={cx(
                        "absolute right-0 mt-2 w-44 overflow-hidden",
                        "rounded-2xl border border-[#3a3f4b] bg-[#0b0e14]/95 backdrop-blur-xl",
                        "shadow-[0_30px_120px_rgba(0,0,0,0.55)]"
                      )}
                      role="menu"
                    >
                      <div className="p-2">
                        {legalItems.map((it) => (
                          <NavLink
                            key={it.to}
                            to={it.to}
                            className={({ isActive }) =>
                              cx(
                                "block rounded-xl px-3 py-2 text-sm transition",
                                isActive
                                  ? "bg-white/10 text-white"
                                  : "text-white/70 hover:bg-white/10 hover:text-white"
                              )
                            }
                            role="menuitem"
                          >
                            {it.label}
                          </NavLink>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Desktop: Login */}
              <Link
                to="/login"
                className={cx(
                  "hidden lg:inline-flex items-center justify-center gap-2",
                  "rounded-xl border border-[#3a3f4b] bg-[#0b0e14]/35",
                  "px-3 py-2 text-sm font-semibold text-white/80",
                  "hover:border-[#cfae5d] hover:text-white transition"
                )}
              >
                <LogIn className="h-4 w-4 text-white/70" />
                Log in
              </Link>

              {/* Desktop: Primary CTA (reveals after scroll, then persists for session) */}
              <AnimatePresence initial={false}>
                {trialCtaRevealed && (
                  <motion.div
                    variants={popIn}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    className="hidden lg:block"
                  >
                    <Link
                      to="/signup"
                      className={cx(
                        "inline-flex items-center justify-center gap-2",
                        "rounded-xl border-[var(--color-blue)]/40 hover:border-[var(--color-blue)] transition-all duration-500 ease-in-out border-1 px-4 py-2 text-sm font-semibold text-white",
                        "hover:opacity-90 transition"
                      )}
                    >
                      Try it free
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mobile / Tablet menu button: visible until lg */}
              <button
                type="button"
                onClick={() => setOpen(true)}
                className={cx(
                  "lg:hidden inline-flex items-center justify-center",
                  "h-10 w-10 rounded-xl",
                  "border border-white/10 bg-white/5 hover:bg-white/10 transition"
                )}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5 text-white/80" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu (also used on md widths now — fixes the awkward mid breakpoint) */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[60]"
            initial="hidden"
            animate="show"
            exit="exit"
          >
            {/* Dim / overlay */}
            <motion.button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-black/55"
              variants={overlayIn}
              onClick={() => setOpen(false)}
            />

            {/* Drawer */}
            <motion.aside
              variants={drawerIn}
              className={cx(
                "absolute right-3 top-3 w-[min(92vw,420px)]",
                "rounded-2xl border border-[#3a3f4b] bg-[#0b0e14]/90 backdrop-blur-xl",
                "shadow-[0_30px_120px_rgba(0,0,0,0.65)]"
              )}
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
                <div className="inline-flex items-center gap-3">
                  <img
                    src={logo}
                    alt="ROOFZEUS"
                    className="h-7 w-auto select-none"
                    draggable={false}
                  />
                  <div className="text-sm text-white/65">Menu</div>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className={cx(
                    "inline-flex items-center justify-center",
                    "h-10 w-10 rounded-xl",
                    "border border-white/10 bg-white/5 hover:bg-white/10 transition"
                  )}
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5 text-white/80" />
                </button>
              </div>

              <div className="px-4 py-4">
                <div className="grid gap-2">
                  {items.map((it) => (
                    <NavLink
                      key={it.to}
                      to={it.to}
                      className={({ isActive }) =>
                        cx(
                          "rounded-xl px-3 py-3 text-sm font-semibold transition",
                          "border border-white/10",
                          isActive
                            ? "bg-white/10 text-[#f5f6f8]"
                            : "bg-white/5 text-white/75 hover:bg-white/10"
                        )
                      }
                    >
                      {it.label}
                    </NavLink>
                  ))}

                  <div className="mt-2 text-[11px] uppercase tracking-wider text-white/40 px-1">
                    Legal
                  </div>

                  {legalItems.map((it) => (
                    <NavLink
                      key={it.to}
                      to={it.to}
                      className={({ isActive }) =>
                        cx(
                          "rounded-xl px-3 py-3 text-sm font-semibold transition",
                          "border border-white/10",
                          isActive
                            ? "bg-white/10 text-[#f5f6f8]"
                            : "bg-white/5 text-white/75 hover:bg-white/10"
                        )
                      }
                    >
                      {it.label}
                    </NavLink>
                  ))}
                </div>

                <div className="mt-4 grid gap-2">
                  <AnimatePresence initial={false}>
                    {trialCtaRevealed && (
                      <motion.div
                        variants={popIn}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                      >
                        <Link
                          to="/signup"
                          className={cx(
                            "inline-flex items-center justify-center gap-2",
                            "rounded-xl bg-[#cfae5d] px-4 py-3",
                            "text-sm font-semibold text-black hover:opacity-90 transition"
                          )}
                        >
                          Start free trial
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <Link
                    to="/login"
                    className={cx(
                      "inline-flex items-center justify-center gap-2",
                      "rounded-xl border border-[#3a3f4b] bg-[#0b0e14]/35",
                      "px-4 py-3 text-sm font-semibold text-white/85",
                      "hover:border-[#cfae5d] transition"
                    )}
                  >
                    <LogIn className="h-4 w-4 text-white/70" />
                    Log in
                  </Link>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/65 leading-relaxed">
                  <div className="font-semibold text-white/80">
                    14-day free trial
                  </div>
                  <div className="mt-1">
                    No card required up front. Cancel anytime.
                  </div>
                </div>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
