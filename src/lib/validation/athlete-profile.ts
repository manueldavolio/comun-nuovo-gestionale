import { z } from "zod";

import { ATHLETE_ROLE_CODES } from "@/lib/athlete-roles";

export const updateAthleteProfileSchema = z.object({
  position: z.preprocess(
    (value) => {
      if (value === undefined) return undefined;
      if (value == null) return null;
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      if (trimmed.length === 0) return null;
      return trimmed.toUpperCase();
    },
    z.union([z.enum(ATHLETE_ROLE_CODES), z.null()]).optional(),
  ),
  shirtNumber: z
    .union([z.number().int().min(0).max(99), z.null()])
    .optional()
    .nullable(),
});

export const upsertAthleteCoachNoteSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  content: z
    .string()
    .trim()
    .min(1, "Scrivi una nota.")
    .max(2000, "Nota troppo lunga."),
});

export type UpdateAthleteProfileInput = z.infer<typeof updateAthleteProfileSchema>;
export type UpsertAthleteCoachNoteInput = z.infer<typeof upsertAthleteCoachNoteSchema>;
