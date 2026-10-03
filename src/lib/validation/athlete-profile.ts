import { z } from "zod";

export const updateAthleteProfileSchema = z.object({
  position: z
    .string()
    .trim()
    .max(40, "Ruolo troppo lungo.")
    .optional()
    .nullable()
    .transform((value) => {
      if (value == null) return null;
      const trimmed = value.trim();
      return trimmed.length === 0 ? null : trimmed;
    }),
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
