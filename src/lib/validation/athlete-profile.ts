import { z } from "zod";

import { ATHLETE_ROLE_CODES } from "@/lib/athlete-roles";
import {
  MAX_ACTIVE_PERSONAL_GOALS,
  PERSONAL_GOAL_STATUSES,
  PERSONAL_GOAL_TEXT_MAX,
} from "@/lib/athlete-personal-goals";
import {
  MAX_POSITIVE_COACH_TAGS,
  POSITIVE_COACH_TAGS,
} from "@/lib/coach-note-tags";

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
  positiveTags: z
    .array(z.enum(POSITIVE_COACH_TAGS))
    .max(MAX_POSITIVE_COACH_TAGS, `Massimo ${MAX_POSITIVE_COACH_TAGS} tag positivi.`)
    .optional()
    .default([]),
});

export const createAthletePersonalGoalSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Scrivi un obiettivo.")
    .max(PERSONAL_GOAL_TEXT_MAX, "Obiettivo troppo lungo."),
  periodMonth: z.number().int().min(1).max(12).optional().nullable(),
  periodYear: z.number().int().min(2020).max(2100).optional().nullable(),
  status: z.enum(PERSONAL_GOAL_STATUSES).optional().default("IN_PROGRESS"),
});

export const updateAthletePersonalGoalSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1, "Scrivi un obiettivo.")
      .max(PERSONAL_GOAL_TEXT_MAX, "Obiettivo troppo lungo.")
      .optional(),
    status: z.enum(PERSONAL_GOAL_STATUSES).optional(),
    periodMonth: z.number().int().min(1).max(12).optional().nullable(),
    periodYear: z.number().int().min(2020).max(2100).optional().nullable(),
  })
  .refine((value) => value.text !== undefined || value.status !== undefined, {
    message: "Nessuna modifica.",
  });

export type UpdateAthleteProfileInput = z.infer<typeof updateAthleteProfileSchema>;
export type UpsertAthleteCoachNoteInput = z.infer<typeof upsertAthleteCoachNoteSchema>;
export type CreateAthletePersonalGoalInput = z.infer<typeof createAthletePersonalGoalSchema>;
export type UpdateAthletePersonalGoalInput = z.infer<typeof updateAthletePersonalGoalSchema>;

export { MAX_ACTIVE_PERSONAL_GOALS };
