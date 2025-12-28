// src/components/marketing/MarketingLayout.tsx
import { Outlet, Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
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

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#3a3f4b] bg-[#0b0e14]/50 px-2.5 py-1 text-[11px] text-[#cfae5d]/80">
      {children}
    </span>
  );
}

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
        <footer className="relative border-t border-[#3a3f4b] bg-[#0b0e14]/75 backdrop-blur">
          <div className="mx-auto max-w-7xl px-6 py-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
              <div>
                <div className="text-sm text-white/70">
                  ROOFZEUS is purpose-built for roofing contractors.
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill>Org-scoped</Pill>
                  <Pill>14-day trial</Pill>
                  <Pill>No card required</Pill>
                  <Pill>Cancel anytime</Pill>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 text-sm">
                <Link
                  to="/"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/75 hover:text-white hover:bg-white/10 transition"
                >
                  Home
                </Link>
                <Link
                  to="/pricing"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/75 hover:text-white hover:bg-white/10 transition"
                >
                  Pricing
                </Link>
                <Link
                  to="/see-it-in-action"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/75 hover:text-white hover:bg-white/10 transition"
                >
                  See it in action
                </Link>
                <Link
                  to="/login"
                  className="rounded-xl border border-[#3a3f4b] bg-[#0b0e14]/35 px-3 py-2 text-white/80 hover:border-[#cfae5d] hover:text-white transition"
                >
                  Log in
                </Link>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[12px] text-white/45">
              <div>© {new Date().getFullYear()} ROOFZEUS</div>
              <div className="flex gap-4">
                {/* Placeholder links (optional later): privacy/terms/contact */}
                <span className="text-white/35">
                  Built to replace spreadsheets and guesswork.
                </span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
