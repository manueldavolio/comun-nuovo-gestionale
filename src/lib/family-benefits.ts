import type { FamilyBenefitAudience } from "@prisma/client";
import { classifyWeekendCategory } from "@/lib/social-studio/weekend-sectors";

export const OFFICIAL_TEAM_SHOP_URL =
  "https://teamshop.onisitalia.it/product-category/asd-comun-nuovo/";

export const FAMILY_BENEFIT_AUDIENCE_LABEL: Record<FamilyBenefitAudience, string> = {
  ALL: "Tutte le famiglie",
  YOUTH: "Settore giovanile",
  FIRST_TEAM: "Prima squadra",
  BASE_ACTIVITY: "Attività di base",
};

export type BenefitAudienceContext = {
  categoryName: string;
  sector: "YOUTH" | "FIRST_TEAM" | null;
};

export function resolveBenefitAudienceBucket(
  input: BenefitAudienceContext,
): Exclude<FamilyBenefitAudience, "ALL"> {
  if (input.sector === "FIRST_TEAM") return "FIRST_TEAM";
  const weekend = classifyWeekendCategory(input.categoryName);
  if (weekend && ["PRIMI_CALCI", "PULCINI_2017", "ESORDIENTI"].includes(weekend)) {
    return "BASE_ACTIVITY";
  }
  // Categorie base non sempre tipizzate nel weekend classifier (es. Pulcini senza anno).
  if (/\b(primi\s*calci|pulcini|esordienti|scuola\s*calcio|gioco\s*sport)\b/i.test(input.categoryName)) {
    return "BASE_ACTIVITY";
  }
  return "YOUTH";
}

export function isFamilyBenefitVisibleToAudience(input: {
  audience: FamilyBenefitAudience;
  isPublished: boolean;
  isActive: boolean;
  expiresAt: Date | null;
  now?: Date;
  viewer: BenefitAudienceContext;
}): boolean {
  if (!input.isPublished || !input.isActive) return false;
  const now = input.now ?? new Date();
  if (input.expiresAt && input.expiresAt.getTime() < now.getTime()) return false;
  if (input.audience === "ALL") return true;
  return input.audience === resolveBenefitAudienceBucket(input.viewer);
}

export function sortFamilyBenefits<T extends { priority: number; sortOrder: number; name: string }>(
  rows: T[],
): T[] {
  return [...rows].sort(
    (a, b) =>
      b.priority - a.priority || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "it"),
  );
}
