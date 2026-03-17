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

// Additional imports for brand logo and menu management
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import BrandLogoModal from "../components/BrandLogoModal";

import logo from "../assets/logo-white.svg";

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
      ? "bg-[rgb(var(--color-surface-rgb)/0.88)] text-[rgb(var(--color-text-rgb)/0.94)] "
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
  // Track whether the org menu (settings dropdown) is open
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  // Track whether the brand logo modal is open
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  // Store the active organization’s logo URL (if any)
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);
  // Ref to detect clicks outside of the org menu
  const orgMenuRef = useRef<HTMLDivElement>(null);

  const {
    orgId: activeOrgId,
    orgName: activeOrgName,
    memberships,
    setOrgId: setActiveOrgId,
    loading: membershipLoading,
  } = useOrg();

  // Subscribe to the organization document to pull the logoUrl for the active org
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

  // Close the org menu when clicking outside of it
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
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [orgMenuOpen]);

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
                <img
                  src={logo}
                  alt="RoofZeus logo"
                  className="w-[80px] shadow-md brand-logo"
                />

                {/* Organization branding block */}
                <div className=" min-w-0 flex items-center gap-3">
                  <div className="flex flex-col min-w-0">
                    {/* Org switcher if user is a member of multiple organizations */}
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
                  <div className="flex items-center gap-2 min-w-0">
                    {orgLogoUrl && (
                      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md border border-[rgb(var(--color-border-rgb)/0.18)] bg-white/95 shadow-sm">
                        <img
                          src={orgLogoUrl}
                          alt={`${activeOrgName || "Organization"} logo`}
                          className="h-full w-full object-contain"
                        />
                      </div>
                    )}
                    {/* Org name with dropdown arrow */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setOrgMenuOpen((v) => !v);
                        }}
                        className="flex items-center gap-1 truncate text-sm font-semibold text-[rgb(var(--color-text-rgb)/0.92)] outline-none"
                      >
                        <span className="truncate">
                          {activeOrgName || activeNavLabel}
                        </span>
                        <ChevronDown
                          className={`ml-1 h-3 w-3 transition-transform duration-200 ${
                            orgMenuOpen ? "-rotate-180" : "rotate-0"
                          }`}
                        />
                      </button>
                      {/* Dropdown menu */}
                      {orgMenuOpen && (
                        <div
                          ref={orgMenuRef}
                          className="absolute z-50 mt-2 min-w-[12rem] rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.98)] py-4 px-2 shadow-xl"
                        >
                          <button
                            onClick={() => {
                              setOrgMenuOpen(false);
                              setBrandModalOpen(true);
                            }}
                            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[rgb(var(--color-text-rgb)/0.88)] hover:bg-[rgb(var(--color-surface-rgb)/0.75)]"
                          >
                            Organization Settings
                          </button>
                          {/* Future options can be added here */}
                        </div>
                      )}
                    </div>
                  </div>
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

      {/* Brand logo modal: allows users to update their organization logo */}
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
