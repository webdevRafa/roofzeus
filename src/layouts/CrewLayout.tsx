import type { PropsWithChildren } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { getAuth } from "firebase/auth";
import { ClipboardList, LogOut, UserRound } from "lucide-react";

import { ThemeToggleButton } from "../theme/ThemeToggleButton";
import { useCurrentEmployee } from "../hooks/useCurrentEmployee";
import logo from "../assets/rz-modern-white.svg";

export default function CrewLayout({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const { employee } = useCurrentEmployee();
  const [signingOut, setSigningOut] = useState(false);

  const displayName =
    employee?.name?.trim() || employee?.email?.trim() || "Crew member";

  async function handleSignOut() {
    try {
      setSigningOut(true);
      await getAuth().signOut();
      navigate("/login");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="rz-crew-shell min-h-screen bg-[var(--color-background)] text-[var(--color-text)]">
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--rz-topbar)] backdrop-blur-xl">
        <div className="mx-auto flex h-17 w-full max-w-[1180px] items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => navigate("/crew")}
            className="shrink-0"
            aria-label="Go to my work"
          >
            <img
              src={logo}
              alt="Roof Zeus"
              className="brand-logo w-[104px]"
            />
          </button>

          <div className="mx-2 hidden h-6 w-px bg-[var(--color-border)] sm:block" />

          <div className="hidden sm:block">
            <div className="text-[11px] font-semibold text-[rgb(var(--color-text-rgb)/0.76)]">
              Field workspace
            </div>
            <div className="mt-0.5 text-[9px] text-[var(--color-muted)]">
              Only the work assigned to you
            </div>
          </div>

          <nav className="ml-auto hidden items-center md:flex">
            <NavLink
              to="/crew"
              end
              className={({ isActive }) =>
                [
                  "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition",
                  isActive
                    ? "bg-[var(--rz-nav-active)] text-[var(--color-blue)]"
                    : "text-[var(--color-muted)] hover:bg-[var(--rz-nav-hover)] hover:text-[var(--color-text)]",
                ].join(" ")
              }
            >
              <ClipboardList className="h-4 w-4" />
              My work
            </NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-1.5 md:ml-3">
            <div className="hidden max-w-[210px] items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-alt)] px-3 py-2 text-[11px] text-[rgb(var(--color-text-rgb)/0.72)] sm:flex">
              <UserRound className="h-3.5 w-3.5 shrink-0 text-[var(--color-blue)]" />
              <span className="truncate">{displayName}</span>
            </div>

            <ThemeToggleButton />

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="rz-icon-button inline-flex h-9 w-9 items-center justify-center disabled:opacity-50"
              aria-label={signingOut ? "Signing out" : "Sign out"}
              title={signingOut ? "Signing out…" : "Sign out"}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="rz-crew-main mx-auto w-full max-w-[1180px] px-3 py-4 pb-10 sm:px-6 sm:py-6">
        {children || <Outlet />}
      </main>
    </div>
  );
}
