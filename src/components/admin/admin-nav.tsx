"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  HeartPulse,
  Home,
  Images,
  LayoutDashboard,
  LayoutGrid,
  Megaphone,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Trophy,
  UserCog,
  UserRound,
  Users,
  Wallet,
  X,
  Globe,
  Sparkles,
} from "lucide-react";

type AdminNavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  /** Visibile solo al ruolo ADMIN (nascosto a YOUTH_DIRECTOR). */
  adminOnly?: boolean;
  group: "ops" | "admin" | "comms";
};

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, group: "ops" },
  { href: "/admin/calendario", label: "Calendario", icon: CalendarDays, group: "ops" },
  { href: "/admin/atleti", label: "Atleti", icon: Users, group: "ops" },
  { href: "/admin/categorie", label: "Categorie", icon: LayoutGrid, group: "ops" },
  { href: "/admin/staff", label: "Staff", icon: UserRound, group: "ops" },
  { href: "/admin/utenti", label: "Utenti", icon: UserCog, group: "admin" },
  { href: "/admin/finanze", label: "Finanze", icon: Wallet, group: "admin" },
  { href: "/admin/schedina", label: "Schedina", icon: Trophy, adminOnly: true, group: "admin" },
  { href: "/admin/documenti", label: "Documenti", icon: FileText, group: "admin" },
  {
    href: "/admin/visite-mediche",
    label: "Visite mediche",
    icon: HeartPulse,
    group: "admin",
  },
  {
    href: "/admin/comunicazioni",
    label: "Comunicazioni",
    icon: Megaphone,
    group: "comms",
  },
  { href: "/admin/media", label: "Media", icon: Images, group: "comms" },
  {
    href: "/social/studio",
    label: "Social Studio",
    icon: Sparkles,
    adminOnly: true,
    group: "comms",
  },
  { href: "/admin/sito-web", label: "Sito web", icon: Globe, adminOnly: true, group: "comms" },
];

const GROUP_LABEL: Record<AdminNavItem["group"], string> = {
  ops: "Operatività",
  admin: "Amministrazione",
  comms: "Comunicazione",
};

const GROUP_ORDER: AdminNavItem["group"][] = ["ops", "admin", "comms"];

const COLLAPSE_KEY = "comun-admin-sidebar-collapsed";
const COLLAPSE_EVENT = "comun-admin-sidebar";

function isItemActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

type AdminNavProps = {
  role?: string;
};

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: AdminNavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={item.label}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={[
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
        collapsed ? "justify-center px-2" : "",
        active
          ? "bg-white/15 text-white shadow-sm ring-1 ring-white/20"
          : "text-sky-100/90 hover:bg-white/10 hover:text-white",
      ].join(" ")}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <span className={collapsed ? "sr-only" : "truncate"}>{item.label}</span>
      {collapsed ? (
        <span
          className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-lg bg-blue-950 px-2 py-1 text-xs font-bold text-white shadow-lg group-hover:block"
          aria-hidden
        >
          {item.label}
        </span>
      ) : null}
    </Link>
  );
}

function readCollapsedPreference(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeCollapsed(onStoreChange: () => void) {
  const handler = () => onStoreChange();
  window.addEventListener("storage", handler);
  window.addEventListener(COLLAPSE_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(COLLAPSE_EVENT, handler);
  };
}

function useSidebarCollapsed() {
  return useSyncExternalStore(
    subscribeCollapsed,
    readCollapsedPreference,
    () => false,
  );
}

function setSidebarCollapsed(next: boolean) {
  try {
    window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(COLLAPSE_EVENT));
}

export function AdminNav({ role }: AdminNavProps) {
  const pathname = usePathname() ?? "";
  const collapsed = useSidebarCollapsed();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  const menuCloseRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const menuBtn = menuBtnRef.current;
    document.body.style.overflow = "hidden";
    menuCloseRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      menuBtn?.focus();
    };
  }, [menuOpen]);

  function toggleCollapsed() {
    setSidebarCollapsed(!collapsed);
  }

  const items = useMemo(
    () => ADMIN_NAV_ITEMS.filter((item) => !item.adminOnly || role === "ADMIN"),
    [role],
  );

  const grouped = useMemo(() => {
    return GROUP_ORDER.map((group) => ({
      group,
      label: GROUP_LABEL[group],
      items: items.filter((item) => item.group === group),
    })).filter((g) => g.items.length > 0);
  }, [items]);

  const bottomItems = [
    {
      href: "/admin",
      label: "Home",
      icon: Home,
      active: pathname === "/admin",
    },
    {
      href: "/admin/calendario",
      label: "Calendario",
      icon: CalendarDays,
      active: pathname.startsWith("/admin/calendario"),
    },
    {
      href: "/admin/atleti",
      label: "Atleti",
      icon: Users,
      active: pathname.startsWith("/admin/atleti"),
    },
  ] as const;

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-blue-950/40 bg-gradient-to-b from-blue-950 via-blue-900 to-sky-900 text-white shadow-xl shadow-blue-950/20 transition-[width] duration-200 md:flex",
          collapsed ? "w-[4.5rem]" : "w-64",
        ].join(" ")}
      >
        <div
          className={[
            "flex items-center gap-3 border-b border-white/10 px-3 py-4",
            collapsed ? "justify-center" : "px-4",
          ].join(" ")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-home.png"
            alt="ASD Comun Nuovo"
            className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-0.5 shadow-md"
          />
          {!collapsed ? (
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-200">
                ASD Comun Nuovo
              </p>
              <p className="truncate text-sm font-black tracking-tight">Centro controllo</p>
            </div>
          ) : null}
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-4">
          {grouped.map((section) => (
            <div key={section.group}>
              {!collapsed ? (
                <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-sky-200/70">
                  {section.label}
                </p>
              ) : (
                <div className="mx-auto mb-2 h-px w-8 bg-white/15" aria-hidden />
              )}
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <NavLink
                      item={item}
                      active={isItemActive(pathname, item.href)}
                      collapsed={collapsed}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-2">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-sky-100 transition hover:bg-white/10 hover:text-white"
            aria-label={collapsed ? "Espandi menu" : "Comprimi menu"}
            title={collapsed ? "Espandi menu" : "Comprimi menu"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5" aria-hidden />
            ) : (
              <>
                <PanelLeftClose className="h-5 w-5" aria-hidden />
                <span>Comprimi</span>
                <ChevronLeft className="h-4 w-4 opacity-70" aria-hidden />
              </>
            )}
            {collapsed ? <ChevronRight className="sr-only" /> : null}
          </button>
        </div>
      </aside>

      {/* Mobile top brand strip */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-blue-100 bg-gradient-to-r from-blue-950 via-blue-900 to-sky-800 px-4 py-3 text-white md:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-home.png"
          alt=""
          className="h-9 w-9 rounded-xl bg-white object-contain p-0.5"
        />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-sky-200">
            ASD Comun Nuovo
          </p>
          <p className="truncate text-sm font-black">Area Admin</p>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-blue-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-[1100px] grid-cols-4">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${
                  item.active ? "text-blue-800" : "text-zinc-500"
                }`}
              >
                <Icon className={`h-5 w-5 ${item.active ? "text-blue-800" : "text-zinc-400"}`} />
                {item.label}
              </Link>
            );
          })}
          <button
            ref={menuBtnRef}
            type="button"
            onClick={() => setMenuOpen(true)}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${
              menuOpen ? "text-blue-800" : "text-zinc-500"
            }`}
            aria-label="Apri menu completo"
            aria-expanded={menuOpen}
            aria-controls="admin-mobile-menu"
          >
            <Menu className={`h-5 w-5 ${menuOpen ? "text-blue-800" : "text-zinc-400"}`} aria-hidden />
            Menu
          </button>
        </div>
      </nav>

      {/* Mobile full menu drawer */}
      {menuOpen ? (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu completo Area Admin"
        >
          <button
            type="button"
            className="absolute inset-0 bg-blue-950/50"
            aria-label="Chiudi menu"
            onClick={() => setMenuOpen(false)}
          />
          <div
            id="admin-mobile-menu"
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border border-blue-100 bg-white pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-2xl"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-sky-100 bg-white px-4 py-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-800">
                  Menu completo
                </p>
                <p className="text-sm font-semibold text-zinc-600">Funzioni autorizzate</p>
              </div>
              <button
                ref={menuCloseRef}
                type="button"
                onClick={() => setMenuOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-blue-100 text-blue-800"
                aria-label="Chiudi menu"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="space-y-4 p-4">
              {grouped.map((section) => (
                <div key={section.group}>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-800">
                    {section.label}
                  </p>
                  <ul className="grid gap-2">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const active = isItemActive(pathname, item.href);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setMenuOpen(false)}
                            className={[
                              "flex min-h-12 items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-bold",
                              active
                                ? "border-blue-700 bg-blue-800 text-white"
                                : "border-sky-100 bg-sky-50/80 text-blue-950",
                            ].join(" ")}
                          >
                            <Icon className="h-5 w-5 shrink-0" aria-hidden />
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Spacer for desktop content offset — applied via CSS variable on shell */}
      <div
        className="pointer-events-none fixed left-0 top-0 hidden h-0 w-0 md:block"
        data-admin-sidebar-collapsed={collapsed ? "1" : "0"}
        aria-hidden
      />
      <AdminSidebarOffset collapsed={collapsed} />
    </>
  );
}

function AdminSidebarOffset({ collapsed }: { collapsed: boolean }) {
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--admin-sidebar-width",
      collapsed ? "4.5rem" : "16rem",
    );
    return () => {
      document.documentElement.style.removeProperty("--admin-sidebar-width");
    };
  }, [collapsed]);
  return null;
}

export function AdminShell({
  role,
  children,
}: {
  role?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen overflow-x-clip bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-100 via-slate-50 to-blue-100/50">
      <AdminNav role={role} />
      <div className="min-w-0 scroll-pb-[calc(5.5rem+env(safe-area-inset-bottom))] pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:scroll-pb-0 md:pb-8 md:pl-[var(--admin-sidebar-width,16rem)]">
        {children}
      </div>
    </div>
  );
}
