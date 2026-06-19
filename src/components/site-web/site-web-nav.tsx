"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SiteWebNavItem = {
  href: string;
  label: string;
};

const SITE_WEB_NAV_ITEMS: SiteWebNavItem[] = [
  { href: "/admin/sito-web", label: "Panoramica" },
  { href: "/admin/sito-web/giocatori", label: "Giocatori" },
  { href: "/admin/sito-web/staff", label: "Staff" },
  { href: "/admin/sito-web/news", label: "News" },
  { href: "/admin/sito-web/sponsor", label: "Sponsor" },
  { href: "/admin/sito-web/galleria", label: "Galleria" },
  { href: "/admin/sito-web/video", label: "Video" },
  { href: "/admin/sito-web/impostazioni", label: "Impostazioni" },
];

function isItemActive(pathname: string, href: string) {
  if (href === "/admin/sito-web") {
    return pathname === "/admin/sito-web";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteWebNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Sezioni sito web">
      <ul className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-white p-2 shadow-sm">
        {SITE_WEB_NAV_ITEMS.map((item) => {
          const active = isItemActive(pathname, item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`inline-flex whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-blue-700 text-white shadow-sm"
                    : "text-blue-700 hover:bg-blue-50"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
