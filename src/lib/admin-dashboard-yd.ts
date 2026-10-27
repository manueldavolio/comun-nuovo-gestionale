/**
 * Pure helpers for YOUTH_DIRECTOR dashboard composition (UI only).
 * Does not grant permissions — pages/APIs remain the source of truth.
 * Event/category scope for YD is Category.sector === YOUTH (see category-event-access).
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

/** Prisma-style athlete filter for YD KPIs (only youth category ids). */
export function youthDirectorAthleteCategoryFilter(youthCategoryIds: string[]) {
  return { categoryId: { in: youthCategoryIds } };
}

/**
 * Documenti archivio: conteggio coerente con categorie YOUTH via athlete.categoryId.
 * Se non ci sono categorie YOUTH, il conteggio è 0 (fail-closed).
 */
export function youthDirectorDocumentAthleteFilter(youthCategoryIds: string[]) {
  return {
    athlete: {
      categoryId: { in: youthCategoryIds },
    },
  };
}

/**
 * @deprecated E0.1d Fase 2 — YD non è più limitato alle assegnazioni coach.
 * Conservato come no-op false per evitare regressioni di import residui.
 */
export function shouldRestrictYouthDirectorToAssignedCategories(
  role: string | null | undefined,
  assignedCategoryIds: string[],
): boolean {
  void role;
  void assignedCategoryIds;
  return false;
}

/** YD event UI uses all youth sectors, never coach assignments. */
export function youthDirectorUsesYouthSectorEventScope(
  role: string | null | undefined,
): boolean {
  return role === "YOUTH_DIRECTOR";
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
