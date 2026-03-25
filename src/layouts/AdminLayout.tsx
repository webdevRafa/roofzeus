// src/layouts/AdminLayout.tsx
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect, useRef } from "react";
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
  ChevronDown,
} from "lucide-react";

import { ThemeToggleButton } from "../theme/ThemeToggleButton";
import { useOrg } from "../contexts/OrgContext";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import BrandLogoModal from "../components/BrandLogoModal";

import logo from "../assets/rz-modern-white.svg";

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

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function navLinkBase(isActive: boolean) {
  return cx(
    "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-colors",
    isActive
      ? " text-[var(--color-text)] "
      : "text-[var(--color-text)]/70 hover:text-[var(--color-text)]"
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
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);

  const orgMenuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!orgMenuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        orgMenuRef.current &&
        !orgMenuRef.current.contains(event.target as Node)
      ) {
        setOrgMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [orgMenuOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

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
    <div className="min-h-screen bg-[var(--color-background)]">
      <header className="sticky top-0 z-100 select-none">
        <div className="border-b border-[rgb(var(--color-border-rgb)/0.14)] bg-[var(--color-background)]/70 backdrop-blur-xl">
          <div className="mx-auto w-full max-w-[1700px] px-3 sm:px-4 lg:px-6">
            <div className="flex h-[72px] items-center gap-3">
              {/* LEFT: brand / org */}
              <div className="flex min-w-0 shrink-0 items-center gap-3">
                <button
                  onClick={() => navigate("/dashboard")}
                  className="shrink-0"
                  aria-label="Go to dashboard"
                >
                  <img
                    src={logo}
                    alt="RoofZeus logo"
                    className="w-[70px] brand-logo mr-6 lg:mr-20"
                  />
                </button>
                {/* MOBILE: org row */}
                <div className=" py-2 md:hidden">
                  <div className="flex min-w-0 items-center gap-2">
                    {orgLogoUrl && (
                      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-[rgb(var(--color-border-rgb)/0.18)] bg-white/95 shadow-sm">
                        <img
                          src={orgLogoUrl}
                          alt={`${activeOrgName || "Organization"} logo`}
                          className="h-full w-full object-contain"
                        />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-[rgb(var(--color-text-rgb)/0.92)]">
                        {activeOrgName || activeNavLabel}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="hidden min-w-0 md:flex md:items-center md:gap-3">
                  {orgLogoUrl && (
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-[rgb(var(--color-border-rgb)/0.18)] bg-white/95 shadow-sm">
                      <img
                        src={orgLogoUrl}
                        alt={`${activeOrgName || "Organization"} logo`}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  )}

                  <div className="min-w-0">
                    {!membershipLoading && memberships.length > 1 && (
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.5)]">
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

                    <div className="relative" ref={orgMenuRef}>
                      <button
                        type="button"
                        onClick={() => setOrgMenuOpen((v) => !v)}
                        className="inline-flex max-w-[220px] items-center gap-1 rounded-lg text-left text-sm font-semibold text-[rgb(var(--color-text-rgb)/0.92)] outline-none hover:text-[rgb(var(--color-text-rgb)/1)]"
                      >
                        <span className="truncate">
                          {activeOrgName || activeNavLabel}
                        </span>
                        <ChevronDown
                          className={cx(
                            "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                            orgMenuOpen && "rotate-180"
                          )}
                        />
                      </button>

                      {orgMenuOpen && (
                        <div className="absolute left-0 top-full z-50 mt-2 min-w-[13rem] rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.98)] p-2 shadow-xl">
                          <button
                            onClick={() => {
                              setOrgMenuOpen(false);
                              setBrandModalOpen(true);
                            }}
                            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[rgb(var(--color-text-rgb)/0.88)] hover:bg-[rgb(var(--color-surface-rgb)/0.75)]"
                          >
                            Organization Settings
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* CENTER: scrollable desktop nav */}
              <div className="hidden min-w-0 flex-1 md:block">
                <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <nav className="flex min-w-max items-center gap-1.5 pl-1 ">
                    {NAV_ITEMS.map((item) => {
                      const Icon = item.icon;
                      const active = isActivePath(location.pathname, item);

                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className={() => navLinkBase(active)}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </NavLink>
                      );
                    })}
                  </nav>
                </div>
              </div>

              {/* RIGHT: actions */}
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <ThemeToggleButton />

                <button
                  onClick={handleLogout}
                  disabled={signingOut}
                  className="inline-flex p-2 items-center justify-center  text-red-400  transition hover:bg-red-500/50 cursor-pointer disabled:opacity-60 mr-4 md:mr-0"
                  aria-label="Sign out"
                  title={signingOut ? "Signing out..." : "Sign out"}
                >
                  <LogOut className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] text-[rgb(var(--color-text-rgb)/0.85)] transition hover:bg-[rgb(var(--color-surface-rgb)/0.75)] md:hidden"
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

            {/* MOBILE nav panel */}
            {mobileOpen && (
              <div className="pb-3 md:hidden">
                <div className="rounded-2xl border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.72)] p-2 backdrop-blur">
                  {!membershipLoading && memberships.length > 1 && (
                    <div className="mb-2 px-2 pt-1">
                      <label className="mb-1 block text-[10px] uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.55)]">
                        Organization
                      </label>
                      <select
                        value={activeOrgId ?? ""}
                        onChange={(e) => setActiveOrgId(e.target.value)}
                        className="w-full rounded-lg border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.55)] px-3 py-2 text-sm text-[rgb(var(--color-text-rgb)/0.9)] outline-none"
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

                  <div className="mt-2 border-t border-[rgb(var(--color-border-rgb)/0.12)] pt-2">
                    <button
                      onClick={() => {
                        setMobileOpen(false);
                        setBrandModalOpen(true);
                      }}
                      className="block w-full rounded-xl px-3 py-2 text-left text-sm text-[rgb(var(--color-text-rgb)/0.82)] transition hover:bg-[rgb(var(--color-text-rgb)/0.04)]"
                    >
                      Organization Settings
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1700px] px-3 sm:px-4 lg:px-6 py-6 sm:py-8">
        <Outlet />
      </main>

      {brandModalOpen && activeOrgId && (
        <BrandLogoModal
          orgId={activeOrgId}
          currentLogoUrl={orgLogoUrl ?? undefined}
          onClose={() => setBrandModalOpen(false)}
        />
      )}
    </div>
  );
}
