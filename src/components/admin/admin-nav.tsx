"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AdminNavItem = {
  href: string;
  label: string;
};

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/utenti", label: "Utenti" },
  { href: "/admin/categorie", label: "Categorie" },
  { href: "/admin/staff", label: "Staff" },
  { href: "/admin/finanze", label: "Finanze" },
  { href: "/admin/comunicazioni", label: "Comunicazioni" },
  { href: "/admin/documenti", label: "Documenti" },
  { href: "/admin/media", label: "Media" },
  { href: "/admin/visite-mediche", label: "Visite mediche" },
];

function isItemActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-30 border-b border-blue-100 bg-sky-50/95 backdrop-blur">
      <div className="mx-auto w-full max-w-6xl px-4 py-3 md:px-8">
        <ul className="flex flex-wrap items-center gap-2 rounded-2xl border border-blue-100/80 bg-white/80 p-2.5 shadow-sm shadow-blue-950/5">
          {ADMIN_NAV_ITEMS.map((item) => {
            const active = isItemActive(pathname, item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`inline-flex whitespace-nowrap rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? "border-blue-300 bg-blue-100 text-blue-900 shadow-sm"
                      : "border-blue-200 bg-white text-blue-700 hover:border-blue-300 hover:bg-blue-50"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
