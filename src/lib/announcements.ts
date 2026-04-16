import type { AnnouncementAudience } from "@/generated/prisma/enums";

export const ANNOUNCEMENT_AUDIENCE_CHOICES: Array<{ value: AnnouncementAudience; label: string }> = [
  { value: "ALL", label: "Tutti" },
  { value: "PARENTS", label: "Solo genitori" },
  { value: "COACHES", label: "Solo mister" },
  { value: "CATEGORY_ONLY", label: "Solo categoria specifica" },
];

export const ANNOUNCEMENT_AUDIENCE_LABEL: Record<AnnouncementAudience, string> = {
  ALL: "Tutti",
  PARENTS: "Genitori",
  COACHES: "Mister",
  CATEGORY_ONLY: "Categoria",
};
