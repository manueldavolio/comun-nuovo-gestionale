"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Users } from "lucide-react";

const NAV_ITEMS = [
  { href: "/mister", label: "Home", icon: Home, match: (path: string) => path === "/mister" },
  {
    href: "/mister/calendario",
    label: "Calendario",
    icon: CalendarDays,
    match: (path: string) => path.startsWith("/mister/calendario"),
  },
  {
    href: "/mister/squadra",
    label: "Squadra",
    icon: Users,
    match: (path: string) => path.startsWith("/mister/squadra"),
  },
] as const;

function isMatchCenterPath(pathname: string) {
  return /\/mister\/eventi\/[^/]+\/presenze\/?$/.test(pathname);
}

export function MisterNav() {
  const pathname = usePathname() ?? "";
  const hideNav = isMatchCenterPath(pathname);

  if (hideNav) {
    return null;
  }

  return (
    <>
      {/* Desktop top nav */}
      <nav className="sticky top-0 z-30 hidden border-b border-blue-100 bg-white/95 backdrop-blur md:block">
        <div className="mx-auto flex w-full max-w-[1100px] items-center gap-1 px-4 py-2">
          <p className="mr-3 text-xs font-bold uppercase tracking-[0.14em] text-blue-800">
            Area Mister
          </p>
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-blue-800 text-white"
                    : "text-blue-800 hover:bg-sky-50"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-blue-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-[1100px] grid-cols-3">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
                  active ? "text-blue-800" : "text-zinc-500"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "text-blue-800" : "text-zinc-400"}`} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export function MisterShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50">
      <MisterNav />
      <div className="pb-20 md:pb-8">{children}</div>
    </div>
  );
}
