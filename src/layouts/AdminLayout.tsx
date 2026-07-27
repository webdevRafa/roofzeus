import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getAuth, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CalendarRange,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  Settings,
  Users,
  WalletCards,
  X,
} from "lucide-react";

import { db } from "../firebase/firebaseConfig";
import { ThemeToggleButton } from "../theme/ThemeToggleButton";
import { useOrg } from "../contexts/OrgContext";
import logo from "../assets/rz-modern-white.svg";

type AppNavItem = {
  to: string;
  label: string;
  shortLabel?: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

type NavGroup = {
  label: string;
  items: AppNavItem[];
};

const OVERVIEW_ITEM: AppNavItem = {
  to: "/dashboard",
  label: "Overview",
  description: "What needs attention",
  icon: LayoutDashboard,
  exact: true,
};

const JOBS_ITEM: AppNavItem = {
  to: "/jobs",
  label: "Jobs",
  description: "Every roofing job",
  icon: BriefcaseBusiness,
};

const SCHEDULE_ITEM: AppNavItem = {
  to: "/pipeline",
  label: "Schedule",
  description: "Production pipeline",
  icon: CalendarRange,
};

const PAYOUTS_ITEM: AppNavItem = {
  to: "/payouts",
  label: "Payouts",
  description: "Crew pay and records",
  icon: WalletCards,
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Work",
    items: [
      OVERVIEW_ITEM,
      JOBS_ITEM,
      SCHEDULE_ITEM,
      {
        to: "/schedule",
        label: "Calendar",
        description: "Monthly production view",
        icon: CalendarDays,
      },
    ],
  },
  {
    label: "Money",
    items: [
      {
        to: "/financial-overview",
        label: "Financials",
        description: "Profit and expenses",
        icon: BarChart3,
      },
      PAYOUTS_ITEM,
      {
        to: "/invoices-page",
        label: "Invoices",
        description: "Customer billing",
        icon: FileText,
      },
    ],
  },
  {
    label: "People",
    items: [
      {
        to: "/employees",
        label: "Team",
        description: "Members and access",
        icon: Users,
      },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);
const MOBILE_PRIMARY_ITEMS = [
  OVERVIEW_ITEM,
  JOBS_ITEM,
  SCHEDULE_ITEM,
  PAYOUTS_ITEM,
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function isActivePath(pathname: string, item: AppNavItem) {
  if (item.exact) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function pageMeta(pathname: string) {
  if (/^\/job\/[^/]+$/.test(pathname)) {
    return { label: "Job details", section: "Jobs" };
  }
  if (/^\/employees\/[^/]+$/.test(pathname)) {
    return { label: "Team member", section: "Team" };
  }

  const current = ALL_NAV_ITEMS.find((item) =>
    isActivePath(pathname, item)
  );

  if (current) {
    return { label: current.label, section: current.description };
  }

  if (pathname === "/organization-settings") {
    return { label: "Company settings", section: "Workspace" };
  }

  return { label: "Roof Zeus", section: "Workspace" };
}

function SidebarNavItem({
  item,
  pathname,
}: {
  item: AppNavItem;
  pathname: string;
}) {
  const Icon = item.icon;
  const active = isActivePath(pathname, item);

  return (
    <NavLink
      to={item.to}
      className={cx(
        "group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 transition",
        active
          ? "bg-[var(--rz-nav-active)] text-[var(--color-text)] shadow-[inset_0_0_0_1px_rgb(var(--color-border-rgb)/0.12)]"
          : "text-[rgb(var(--color-text-rgb)/0.66)] hover:bg-[var(--rz-nav-hover)] hover:text-[var(--color-text)]"
      )}
    >
      <span
        className={cx(
          "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition",
          active
            ? "bg-[rgb(var(--color-blue-rgb)/0.14)] text-[var(--color-blue)]"
            : "text-[rgb(var(--color-text-rgb)/0.52)] group-hover:text-[var(--color-text)]"
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold leading-4">
          {item.label}
        </span>
        <span className="mt-0.5 block truncate text-[10px] leading-4 text-[rgb(var(--color-text-rgb)/0.42)]">
          {item.description}
        </span>
      </span>

      <ChevronRight
        className={cx(
          "h-3.5 w-3.5 shrink-0 transition",
          active
            ? "text-[var(--color-blue)]"
            : "text-transparent group-hover:text-[rgb(var(--color-text-rgb)/0.35)]"
        )}
      />
    </NavLink>
  );
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [signingOut, setSigningOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);

  const {
    orgId: activeOrgId,
    orgName: activeOrgName,
    memberships,
    setOrgId: setActiveOrgId,
    loading: membershipLoading,
  } = useOrg();

  const meta = useMemo(
    () => pageMeta(location.pathname),
    [location.pathname]
  );

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!activeOrgId) {
      setOrgLogoUrl(null);
      return;
    }

    const orgRef = doc(db, "organizations", activeOrgId);
    return onSnapshot(orgRef, (snap) => {
      const data = snap.data() as { logoUrl?: string | null } | undefined;
      setOrgLogoUrl(data?.logoUrl ?? null);
    });
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

  function startNewJob() {
    navigate("/jobs", { state: { openNewJob: true } });
    setMobileMenuOpen(false);
  }

  const isDetailRoute =
    /^\/job\/[^/]+$/.test(location.pathname) ||
    /^\/employees\/[^/]+$/.test(location.pathname);

  return (
    <div className="rz-app-shell min-h-screen bg-[var(--color-background)] text-[var(--color-text)]">
      <aside className="rz-app-sidebar fixed inset-y-0 left-0 z-40 hidden w-[252px] flex-col border-r border-[var(--color-border)] bg-[var(--rz-sidebar)] md:flex">
        <div className="flex h-17 items-center border-b border-[var(--color-border)] px-5">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center"
            aria-label="Go to overview"
          >
            <img
              src={logo}
              alt="Roof Zeus"
              className="brand-logo h-auto w-[118px]"
            />
          </button>
        </div>

        <div className="border-b border-[var(--color-border)] p-4">
          <button
            type="button"
            onClick={startNewJob}
            className="rz-primary-action flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left"
          >
            <span>
              <span className="block text-[13px] font-semibold">Add a job</span>
              <span className="mt-0.5 block text-[10px] opacity-65">
                Start a new roof record
              </span>
            </span>
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <nav className="space-y-5" aria-label="Main navigation">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="mb-1.5 px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--color-text-rgb)/0.34)]">
                  {group.label}
                </div>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <SidebarNavItem
                      key={item.to}
                      item={item}
                      pathname={location.pathname}
                    />
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="border-t border-[var(--color-border)] p-3">
          <NavLink
            to="/organization-settings"
            className={({ isActive }) =>
              cx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-semibold transition",
                isActive
                  ? "bg-[var(--rz-nav-active)] text-[var(--color-text)]"
                  : "text-[rgb(var(--color-text-rgb)/0.58)] hover:bg-[var(--rz-nav-hover)] hover:text-[var(--color-text)]"
              )
            }
          >
            <Settings className="h-4 w-4" />
            Company settings
          </NavLink>
        </div>
      </aside>

      <div className="min-h-screen md:pl-[252px]">
        <header className="rz-app-topbar sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--rz-topbar)] backdrop-blur-xl">
          <div className="flex h-17 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="mr-1 md:hidden"
              aria-label="Go to overview"
            >
              <img
                src={logo}
                alt="Roof Zeus"
                className="brand-logo w-[88px]"
              />
            </button>

            <div className="hidden min-w-0 md:block">
              <div className="truncate text-sm font-semibold text-[var(--color-text)]">
                {meta.label}
              </div>
              <div className="mt-0.5 truncate text-[10px] text-[rgb(var(--color-text-rgb)/0.44)]">
                {meta.section}
              </div>
            </div>

            <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
              <div className="hidden min-w-0 items-center gap-2 sm:flex">
                {orgLogoUrl ? (
                  <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg border border-[var(--color-border)] bg-white">
                    <img
                      src={orgLogoUrl}
                      alt=""
                      className="h-full w-full object-contain p-0.5"
                    />
                  </div>
                ) : null}

                {!membershipLoading && memberships.length > 1 ? (
                  <label className="relative">
                    <span className="sr-only">Active company</span>
                    <select
                      value={activeOrgId ?? ""}
                      onChange={(event) => setActiveOrgId(event.target.value)}
                      className="rz-compact-select max-w-[190px]"
                    >
                      {memberships.map((membership) => (
                        <option key={membership.id} value={membership.orgId}>
                          {membership.orgId}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="max-w-[180px] truncate text-[11px] font-semibold text-[rgb(var(--color-text-rgb)/0.72)]">
                    {activeOrgName || "Company workspace"}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={startNewJob}
                className="rz-topbar-add inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[11px] font-semibold md:hidden"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden min-[390px]:inline">Job</span>
              </button>

              <ThemeToggleButton />

              <button
                type="button"
                onClick={handleLogout}
                disabled={signingOut}
                className="rz-icon-button hidden h-9 w-9 items-center justify-center sm:inline-flex"
                aria-label={signingOut ? "Signing out" : "Sign out"}
                title={signingOut ? "Signing out…" : "Sign out"}
              >
                <LogOut className="h-4 w-4" />
              </button>

              <button
                type="button"
                className="rz-icon-button inline-flex h-9 w-9 items-center justify-center md:hidden"
                onClick={() => setMobileMenuOpen((open) => !open)}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Menu className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </header>

        <main
          className={cx(
            "rz-app-main min-w-0 pb-24 md:pb-8",
            isDetailRoute
              ? "w-full"
              : "mx-auto w-full max-w-[1560px] px-3 py-4 sm:px-5 sm:py-6 lg:px-8"
          )}
        >
          <Outlet />
        </main>
      </div>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          />

          <div className="absolute inset-x-3 bottom-[84px] max-h-[calc(100dvh-110px)] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-2xl">
            <div className="flex items-center justify-between px-2 pb-3 pt-1">
              <div>
                <div className="text-sm font-semibold">
                  {activeOrgName || "Company workspace"}
                </div>
                <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">
                  All tools
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rz-icon-button inline-flex h-9 w-9 items-center justify-center"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {ALL_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(location.pathname, item);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={cx(
                      "flex min-h-[74px] flex-col justify-between rounded-xl border p-3 transition",
                      active
                        ? "border-[rgb(var(--color-blue-rgb)/0.3)] bg-[rgb(var(--color-blue-rgb)/0.1)] text-[var(--color-text)]"
                        : "border-[var(--color-border)] bg-[var(--color-card-alt)] text-[rgb(var(--color-text-rgb)/0.68)]"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[12px] font-semibold">
                      {item.label}
                    </span>
                  </NavLink>
                );
              })}
            </div>

            <div className="mt-3 grid gap-2 border-t border-[var(--color-border)] pt-3">
              <NavLink
                to="/organization-settings"
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-[12px] font-semibold text-[rgb(var(--color-text-rgb)/0.7)] hover:bg-[var(--color-card-alt)]"
              >
                <Settings className="h-4 w-4" />
                Company settings
              </NavLink>
              <button
                type="button"
                onClick={handleLogout}
                disabled={signingOut}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[12px] font-semibold text-red-300 hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4" />
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <nav className="rz-mobile-nav fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[var(--rz-mobile-nav)] px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-5">
          {MOBILE_PRIMARY_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(location.pathname, item);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cx(
                  "flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[9px] font-semibold transition",
                  active
                    ? "text-[var(--color-blue)]"
                    : "text-[rgb(var(--color-text-rgb)/0.48)]"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {item.shortLabel || item.label}
              </NavLink>
            );
          })}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className={cx(
              "flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[9px] font-semibold transition",
              mobileMenuOpen
                ? "text-[var(--color-blue)]"
                : "text-[rgb(var(--color-text-rgb)/0.48)]"
            )}
          >
            <MoreHorizontal className="h-[18px] w-[18px]" />
            More
          </button>
        </div>
      </nav>
    </div>
  );
}
