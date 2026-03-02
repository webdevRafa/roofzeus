import { Link, Outlet } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import { Facebook, Instagram } from "lucide-react";
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
          <div className="relative mx-auto max-w-7xl px-6 py-5">
            {/* Bottom bar */}
            <div className="mt-10 flex flex-row items-center justify-between gap-3 border-t border-white/10 pt-5 text-[12px] text-white w-full">
              <div className="flex gap-2">
                <Facebook />
                <Instagram />
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
