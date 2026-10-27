/**
 * Pure helpers for YOUTH_DIRECTOR dashboard composition (UI only).
 * Does not grant permissions — pages/APIs remain the source of truth.
 */

export const YD_FORBIDDEN_DASHBOARD_HREFS = [
  "/admin/finanze",
  "/admin/categorie",
  "/admin/staff",
  "/admin/schedina",
  "/admin/sito-web",
  "/social/studio",
] as const;

export type DashboardQuickLinkSpec = {
  href: string;
  label: string;
  description: string;
};

export const YD_QUICK_LINKS: DashboardQuickLinkSpec[] = [
  {
    href: "/admin/calendario",
    label: "Calendario",
    description: "Vista mensile eventi",
  },
  {
    href: "/admin/atleti",
    label: "Atleti",
    description: "Rose e anagrafiche",
  },
  {
    href: "/admin/associazioni-genitori",
    label: "Associazioni",
    description: "Secondo genitore",
  },
  {
    href: "/admin/utenti",
    label: "Utenti",
    description: "Consultazione account",
  },
  {
    href: "/admin/documenti",
    label: "Documenti",
    description: "Archivio metadati",
  },
  {
    href: "/admin/visite-mediche",
    label: "Visite mediche",
    description: "Scadenze sanitarie",
  },
  {
    href: "/admin/comunicazioni",
    label: "Comunicazioni",
    description: "Bacheca avvisi",
  },
  {
    href: "/admin/media",
    label: "Media",
    description: "Foto e video",
  },
];

export function isYouthDirectorDashboardRole(role: string | null | undefined): boolean {
  return role === "YOUTH_DIRECTOR";
}

/** Same rule as admin calendario: restrict only when YD has assigned categories. */
export function shouldRestrictYouthDirectorToAssignedCategories(
  role: string | null | undefined,
  assignedCategoryIds: string[],
): boolean {
  return role === "YOUTH_DIRECTOR" && assignedCategoryIds.length > 0;
}

export function youthDirectorDashboardHasForbiddenHref(href: string): boolean {
  return YD_FORBIDDEN_DASHBOARD_HREFS.some(
    (forbidden) => href === forbidden || href.startsWith(`${forbidden}/`) || href.startsWith(`${forbidden}?`),
  );
}

export function assertYouthDirectorQuickLinksAreAllowed(
  links: DashboardQuickLinkSpec[],
): void {
  for (const link of links) {
    if (youthDirectorDashboardHasForbiddenHref(link.href)) {
      throw new Error(`YD quick link not allowed: ${link.href}`);
    }
  }
}
