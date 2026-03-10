// src/layouts/AdminLayout.tsx
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { getAuth, signOut } from "firebase/auth";
import {
  CalendarDays,
  LayoutDashboard,
  Users,
  FileText,
  LogOut,
  Menu,
  BarChart3,
  X,
} from "lucide-react";

import { ThemeToggleButton } from "../theme/ThemeToggleButton";
import { useOrg } from "../contexts/OrgContext";

import logo from "../assets/logo-white.svg";

function navLinkBase(isActive: boolean) {
  return (
    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition " +
    (isActive
      ? "bg-[rgb(var(--color-surface-rgb)/0.85)] text-[rgb(var(--color-text-rgb)/0.92)] ring-1 ring-[rgb(var(--color-border-rgb)/0.18)]"
      : "text-[rgb(var(--color-text-rgb)/0.72)] hover:bg-[rgb(var(--color-surface-rgb)/0.70)] hover:text-[rgb(var(--color-text-rgb)/0.92)]")
  );
}

export default function AdminLayout() {
  const navigate = useNavigate();

  const [signingOut, setSigningOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // ✅ pull org + memberships from context (provided by AdminShell)
  const {
    orgId: activeOrgId,
    orgName: activeOrgName,
    memberships,
    setOrgId: setActiveOrgId,
    loading: membershipLoading,
  } = useOrg();

  async function handleLogout() {
    try {
      setSigningOut(true);
      await signOut(getAuth());
      navigate("/");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen">
      {/* Global Navbar */}
      <header className="sticky top-0 z-40 select-none">
        <div className="bg-[rgb(var(--color-background-rgb)/0.85)] backdrop-blur border-b border-[rgb(var(--color-border-rgb)/0.14)]">
          <div className="mx-auto w-[min(1200px,94vw)] py-8">
            <div className="flex items-center justify-between gap-3">
              {/* Brand */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate("/dashboard")}
                  className="flex items-center gap-3 text-left"
                >
                  <img
                    src={logo}
                    alt="Roger's Roofing logo"
                    className="w-[100px] shadow-md brand-logo"
                  />

                  <div className="hidden sm:block">
                    {/* ✅ Org switcher */}
                    {!membershipLoading && memberships.length > 1 && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.65)]">
                          Org
                        </span>

                        <select
                          value={activeOrgId ?? ""}
                          onChange={(e) => setActiveOrgId(e.target.value)}
                          className="rounded-lg border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-2 py-1 text-[11px] text-[rgb(var(--color-text-rgb)/0.85)] outline-none hover:bg-[rgb(var(--color-surface-rgb)/0.75)]"
                        >
                          {memberships.map((m) => (
                            <option
                              key={m.id}
                              value={m.orgId}
                              className="text-black"
                            >
                              {m.orgId}
                            </option>
                          ))}
                        </select>

                        {activeOrgName && (
                          <span className="text-[11px] text-[rgb(var(--color-text-rgb)/0.70)] truncate max-w-[160px]">
                            {activeOrgName}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              </div>

              {/* Desktop Nav */}
              <nav className="hidden md:flex items-center gap-2">
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) => navLinkBase(isActive)}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </NavLink>
                <NavLink
                  to="/schedule"
                  className={({ isActive }) => navLinkBase(isActive)}
                >
                  <CalendarDays className="h-4 w-4" />
                  Schedule
                </NavLink>
                <NavLink
                  to="/employees"
                  className={({ isActive }) => navLinkBase(isActive)}
                >
                  <Users className="h-4 w-4" />
                  Members
                </NavLink>
                <NavLink
                  to="/invoices-page"
                  className={({ isActive }) => navLinkBase(isActive)}
                >
                  <FileText className="h-4 w-4" />
                  Invoices
                </NavLink>
                <NavLink
                  to="/financial-overview"
                  className={({ isActive }) => navLinkBase(isActive)}
                >
                  <BarChart3 className="h-4 w-4" />
                  Financial Overview
                </NavLink>
              </nav>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <ThemeToggleButton />

                <button
                  onClick={handleLogout}
                  disabled={signingOut}
                  className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60 shadow-[0_10px_22px_rgba(0,0,0,0.10)]"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  className="md:hidden inline-flex items-center justify-center rounded-lg border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-2 text-[rgb(var(--color-text-rgb)/0.85)] hover:bg-[rgb(var(--color-surface-rgb)/0.75)]"
                  onClick={() => setMobileOpen((v) => !v)}
                  aria-label="Menu"
                >
                  {mobileOpen ? (
                    <X className="h-4 w-4" />
                  ) : (
                    <Menu className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Mobile Nav Panel */}
            {mobileOpen && (
              <div className="md:hidden mt-3 rounded-2xl border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.65)] p-2 backdrop-blur">
                <div className="grid gap-1">
                  <NavLink
                    to="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) => navLinkBase(isActive)}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </NavLink>
                  <NavLink
                    to="/schedule"
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) => navLinkBase(isActive)}
                  >
                    <CalendarDays className="h-4 w-4" />
                    Schedule
                  </NavLink>
                  <NavLink
                    to="/employees"
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) => navLinkBase(isActive)}
                  >
                    <Users className="h-4 w-4" />
                    Members
                  </NavLink>
                  <NavLink
                    to="/financial-overview"
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) => navLinkBase(isActive)}
                  >
                    <BarChart3 className="h-4 w-4" />
                    Financial Overview
                  </NavLink>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1700px] py-6 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}
