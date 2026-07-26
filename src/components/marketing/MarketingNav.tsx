import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, LogIn, Menu, X } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import logo from "../../assets/rz-modern-white.svg";

const navItems = [
  { label: "Home", to: "/" },
  { label: "Product", to: "/features" },
  { label: "Pricing", to: "/pricing" },
  { label: "FAQ", to: "/faq" },
];

export default function MarketingNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <header className="rz-nav">
        <div className="rz-container rz-nav__inner">
          <Link className="rz-nav__brand" to="/" aria-label="Roof Zeus home">
            <img src={logo} alt="Roof Zeus" />
          </Link>

          <nav className="rz-nav__links" aria-label="Primary navigation">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="rz-nav__actions">
            <Link className="rz-nav__login" to="/login">
              <LogIn aria-hidden="true" />
              Log in
            </Link>
            <Link
              className="rz-button rz-button--primary rz-nav__cta"
              to="/signup"
            >
              Try it free
              <ArrowRight aria-hidden="true" />
            </Link>
            <button
              className="rz-nav__menu"
              type="button"
              aria-label="Open navigation"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="rz-mobile-nav"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            onClick={() => setOpen(false)}
          >
            <motion.div
              className="rz-mobile-nav__panel"
              initial={{ x: 32 }}
              animate={{ x: 0 }}
              exit={{ x: 32 }}
              transition={{ duration: 0.2 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="rz-mobile-nav__head">
                <img src={logo} alt="Roof Zeus" />
                <button
                  className="rz-mobile-nav__close"
                  type="button"
                  aria-label="Close navigation"
                  onClick={() => setOpen(false)}
                >
                  <X aria-hidden="true" />
                </button>
              </div>
              <nav className="rz-mobile-nav__links">
                {navItems.map((item) => (
                  <NavLink key={item.to} to={item.to}>
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <div className="rz-actions">
                <Link className="rz-button rz-button--primary" to="/signup">
                  Start free trial
                  <ArrowRight aria-hidden="true" />
                </Link>
                <Link className="rz-button rz-button--secondary" to="/login">
                  Log in
                </Link>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
