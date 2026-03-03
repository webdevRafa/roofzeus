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
              <div className="flex gap-2 ">
                <Facebook className="hover:text-[var(--color-blue)] cursor-pointer" />
                <Instagram className="hover:text-[var(--color-blue)] cursor-pointer" />
              </div>
              <div className="flex items-center gap-4">
                <Link
                  to="/privacy"
                  className="text-white hover:text-[var(--color-blue)] transition"
                >
                  Privacy
                </Link>
                <span className="text-white/20">•</span>
                <Link
                  to="/terms"
                  className="text-white hover:text-[var(--color-blue)] transition"
                >
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
