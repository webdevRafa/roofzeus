// src/layouts/AdminLayout.tsx
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
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
  BriefcaseBusiness,
  Wallet,
  Image as ImageIcon,
} from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";

import { ThemeToggleButton } from "../theme/ThemeToggleButton";
import { useOrg } from "../contexts/OrgContext";
import { db } from "../firebase/firebaseConfig";

import logo from "../assets/logo-white.svg";
import BrandLogoModal from "../components/BrandLogoModal";

type AppNavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

const NAV_ITEMS: AppNavItem[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    to: "/jobs",
    label: "Jobs",
    icon: BriefcaseBusiness,
  },
  {
    to: "/pipeline",
    label: "Pipeline",
    icon: CalendarDays,
  },
  {
    to: "/payouts",
    label: "Payouts",
    icon: Wallet,
  },
  {
    to: "/financial-overview",
    label: "Financial",
    icon: BarChart3,
  },
  {
    to: "/schedule",
    label: "Schedule",
    icon: CalendarDays,
  },
  {
    to: "/employees",
    label: "Members",
    icon: Users,
  },
  {
    to: "/invoices-page",
    label: "Invoices",
    icon: FileText,
  },
];

function navLinkBase(isActive: boolean) {
  return (
    "inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition whitespace-nowrap " +
    (isActive
      ? "bg-[rgb(var(--color-surface-rgb)/0.88)] text-[rgb(var(--color-text-rgb)/0.94)] ring-1 ring-[rgb(var(--color-border-rgb)/0.18)]"
      : "text-[rgb(var(--color-text-rgb)/0.72)] hover:bg-[rgb(var(--color-surface-rgb)/0.72)] hover:text-[rgb(var(--color-text-rgb)/0.94)]")
  );
}

function isActivePath(pathname: string, item: AppNavItem) {
  if (item.exact) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [signingOut, setSigningOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [brandModalOpen, setBrandModalOpen] = useState(false);

  // This is the org brand logo that should appear in the red-square area.
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);

  const {
    orgId: activeOrgId,
    orgName: activeOrgName,
    memberships,
    setOrgId: setActiveOrgId,
    loading: membershipLoading,
  } = useOrg();

  useEffect(() => {
    if (!activeOrgId) {
      setOrgLogoUrl(null);
      return;
    }

    const orgRef = doc(db, "organizations", activeOrgId);

    const unsub = onSnapshot(orgRef, (snap) => {
      const data = snap.data() as { logoUrl?: string | null } | undefined;
      setOrgLogoUrl(data?.logoUrl ?? null);
    });

    return () => unsub();
  }, [activeOrgId]);

  async function handleLogout() {
    try {
      setSigningOut(true);
      await signOut(getAuth());
      navigate("/");
    } finally {
      setSigningOut(false);
    }
  }

  const activeNavLabel = useMemo(() => {
    const current = NAV_ITEMS.find((item) =>
      isActivePath(location.pathname, item)
    );
    return current?.label ?? "Dashboard";
  }, [location.pathname]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 select-none">
        <div className="border-b border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-background-rgb)/0.88)] backdrop-blur">
          <div className="mx-auto w-[min(1400px,95vw)] py-4">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => navigate("/dashboard")}
                className="flex min-w-0 items-center gap-3 text-left"
              >
                {/* Keep RoofZeus as the main platform logo */}
                <img
                  src={logo}
                  alt="RoofZeus logo"
                  className="w-[70px] shadow-md brand-logo shrink-0"
                />

                {/* Replace the red-square content with org logo + text */}
                <div className="hidden min-w-0 sm:flex items-center gap-3">
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {orgLogoUrl ? (
                        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md border border-[rgb(var(--color-border-rgb)/0.18)] bg-white/95 shadow-sm">
                          <img
                            src={orgLogoUrl}
                            alt={`${activeOrgName || "Organization"} logo`}
                            className="h-full w-full object-contain"
                          />
                        </div>
                      ) : null}

                      <div className="truncate text-sm font-semibold text-[rgb(var(--color-text-rgb)/0.92)]">
                        {activeOrgName || activeNavLabel}
                      </div>
                    </div>

                    {!membershipLoading && memberships.length > 1 && (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.55)]">
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
                      </div>
                    )}
                  </div>
                </div>
              </button>

              <div className="flex items-center gap-2">
                <ThemeToggleButton />

                <button
                  type="button"
                  onClick={() => setBrandModalOpen(true)}
                  className="inline-flex items-center justify-center rounded-lg border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] p-2 text-[rgb(var(--color-text-rgb)/0.85)] hover:bg-[rgb(var(--color-surface-rgb)/0.75)]"
                  aria-label="Edit brand settings"
                >
                  <ImageIcon className="h-4 w-4" />
                </button>

                <button
                  onClick={handleLogout}
                  disabled={signingOut}
                  className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(0,0,0,0.10)] hover:bg-red-500 disabled:opacity-60"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-2 text-[rgb(var(--color-text-rgb)/0.85)] hover:bg-[rgb(var(--color-surface-rgb)/0.75)] md:hidden"
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

            {/* Desktop / tablet nav */}
            <div className="mt-4 hidden md:block">
              <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <nav className="flex min-w-max items-center gap-2">
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={() =>
                          navLinkBase(
                            item.exact
                              ? location.pathname === item.to
                              : isActivePath(location.pathname, item)
                          )
                        }
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </NavLink>
                    );
                  })}
                </nav>
              </div>
            </div>

            {/* Mobile nav panel */}
            {mobileOpen && (
              <div className="mt-3 rounded-2xl border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.70)] p-2 backdrop-blur md:hidden">
                <div className="mb-3 flex items-center gap-3 px-2 pt-1">
                  {orgLogoUrl ? (
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md border border-[rgb(var(--color-border-rgb)/0.18)] bg-white/95 shadow-sm">
                      <img
                        src={orgLogoUrl}
                        alt={`${activeOrgName || "Organization"} logo`}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  ) : null}

                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[rgb(var(--color-text-rgb)/0.92)]">
                      {activeOrgName || activeNavLabel}
                    </div>
                  </div>
                </div>

                <div className="grid gap-1">
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileOpen(false)}
                        className={() =>
                          navLinkBase(isActivePath(location.pathname, item))
                        }
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1700px] py-6 sm:py-10">
        <Outlet />
      </main>

      {brandModalOpen && activeOrgId && (
        <BrandLogoModal
          orgId={activeOrgId}
          currentLogoUrl={orgLogoUrl}
          onClose={() => setBrandModalOpen(false)}
        />
      )}
    </div>
  );
}
