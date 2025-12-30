import { Link, Outlet } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import { Mail, Linkedin, Twitter, Youtube, ArrowUpRight } from "lucide-react";
import MarketingNav from "./MarketingNav";

const ease = [0.16, 1, 0.3, 1] as const;

const fade: Variants = {
  hidden: { opacity: 0, filter: "blur(8px)" },
  show: {
    opacity: 1,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease },
  },
};

export default function MarketingLayout() {
  return (
    <div className="min-h-screen bg-[#0b0e14] text-[#f5f6f8]">
      <MarketingNav />

      {/* Global marketing background treatment */}
      <div className="relative">
        {/* ambient gradients */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -left-28 h-[420px] w-[420px] rounded-full bg-[#cfae5d]/10 blur-[110px]" />
          <div className="absolute -bottom-28 -right-28 h-[520px] w-[520px] rounded-full bg-white/5 blur-[130px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(207,174,93,0.10),transparent_55%),radial-gradient(circle_at_70%_55%,rgba(255,255,255,0.06),transparent_60%)]" />
        </div>

        {/* Page content */}
        <motion.div
          variants={fade}
          initial="hidden"
          animate="show"
          className="relative"
        >
          <Outlet />
        </motion.div>

        {/* Footer */}
        <footer className="relative  bg-[#0b0e14]/75 backdrop-blur">
          {/* subtle ambient wash (lightweight, not a whole section) */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 left-1/2 h-[320px] w-[320px] -translate-x-1/2 rounded-full bg-[#cfae5d]/10 blur-[120px]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(207,174,93,0.10),transparent_50%)]" />
          </div>

          <div className="relative mx-auto max-w-7xl px-6 py-10">
            <div className="grid gap-8 md:grid-cols-12">
              {/* Brand / contact */}
              <div className="md:col-span-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 grid place-items-center">
                    <span className="text-[11px] font-semibold tracking-wide text-[#cfae5d]">
                      RZ
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-semibold tracking-tight">
                      ROOFZEUS
                    </div>
                    <div className="text-[12px] text-white/55">
                      Job tracking, crew payouts, and clean financial documents
                      — purpose-built for roofing contractors.
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Link
                    to="/signup"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#cfae5d] px-4 py-2 text-sm font-semibold text-black hover:opacity-90 transition"
                  >
                    Start free trial
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>

                  <Link
                    to="/see-it-in-action"
                    className="inline-flex items-center gap-2 rounded-xl border border-[#3a3f4b] bg-white/0 px-4 py-2 text-sm font-semibold text-white hover:border-[#cfae5d] transition"
                  >
                    Watch demo
                    <ArrowUpRight className="h-4 w-4 text-white/70" />
                  </Link>
                </div>

                <a
                  href="mailto:support@roofzeus.com"
                  className="mt-4 inline-flex items-center gap-2 text-sm text-white/65 hover:text-white transition"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                    <Mail className="h-4 w-4 text-[#cfae5d]" />
                  </span>
                  support@roofzeus.com
                </a>
              </div>

              {/* Links (kept tight to avoid redundancy) */}
              <div className="md:col-span-7">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  <div>
                    <div className="text-[12px] uppercase tracking-wide text-white/45">
                      Product
                    </div>
                    <ul className="mt-3 space-y-2">
                      {[
                        { label: "Features", to: "/features" },
                        { label: "Pricing", to: "/pricing" },
                        { label: "Security", to: "/security" },
                      ].map((l) => (
                        <li key={l.to}>
                          <Link
                            to={l.to}
                            className="text-sm text-white/65 hover:text-white transition"
                          >
                            {l.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="text-[12px] uppercase tracking-wide text-white/45">
                      Resources
                    </div>
                    <ul className="mt-3 space-y-2">
                      {[
                        { label: "FAQ", to: "/faq" },
                        { label: "Demo", to: "/see-it-in-action" },
                        // Optional later:
                        // { label: "Support", to: "/support" },
                      ].map((l) => (
                        <li key={l.to}>
                          <Link
                            to={l.to}
                            className="text-sm text-white/65 hover:text-white transition"
                          >
                            {l.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <div className="text-[12px] uppercase tracking-wide text-white/45">
                      Legal
                    </div>
                    <ul className="mt-3 space-y-2">
                      {[
                        { label: "Privacy", to: "/privacy" },
                        { label: "Terms", to: "/terms" },
                      ].map((l) => (
                        <li key={l.to}>
                          <Link
                            to={l.to}
                            className="text-sm text-white/65 hover:text-white transition"
                          >
                            {l.label}
                          </Link>
                        </li>
                      ))}
                    </ul>

                    {/* Social */}
                    <div className="mt-5 flex items-center gap-2">
                      {[
                        { label: "LinkedIn", Icon: Linkedin, href: "#" },
                        { label: "X", Icon: Twitter, href: "#" },
                        { label: "YouTube", Icon: Youtube, href: "#" },
                      ].map(({ label, Icon, href }) => (
                        <a
                          key={label}
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="group inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:border-[#cfae5d]/40 hover:bg-white/7 transition"
                          aria-label={label}
                          title={label}
                        >
                          <Icon className="h-4 w-4 text-white/70 group-hover:text-[#cfae5d] transition" />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="mt-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-white/10 pt-5 text-[12px] text-white/45">
              <div>
                © {new Date().getFullYear()} ROOFZEUS. All rights reserved.
              </div>
              <div className="flex items-center gap-4">
                <Link to="/privacy" className="hover:text-white transition">
                  Privacy
                </Link>
                <span className="text-white/20">•</span>
                <Link to="/terms" className="hover:text-white transition">
                  Terms
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
