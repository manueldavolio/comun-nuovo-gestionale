import { z } from "zod";
import { AttendanceStatus } from "@prisma/client";
import { FOUR_PERIOD_COUNT } from "@/lib/four-period-scoring";

const attendanceEntrySchema = z.object({
  athleteId: z.string().cuid("Atleta non valido."),
  status: z.nativeEnum(AttendanceStatus, { error: "Stato presenza non valido." }),
  goals: z.number().int().min(0).max(99).optional(),
  assists: z.number().int().min(0).max(99).optional(),
  /** null = non inserito; 0 = zero confermato; omitted = client legacy */
  goalsConceded: z.number().int().min(0).max(99).optional().nullable(),
});

const matchResultSchema = z
  .object({
    opponentName: z.string().trim().max(120).optional().nullable(),
    homeScore: z.number().int().min(0).max(99).optional().nullable(),
    awayScore: z.number().int().min(0).max(99).optional().nullable(),
    isHome: z.boolean().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    const hasHome = value.homeScore != null;
    const hasAway = value.awayScore != null;
    if (hasHome !== hasAway) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Inserisci entrambi i gol (casa e trasferta) oppure nessuno.",
        path: ["homeScore"],
      });
    }
  });

const periodScoreSchema = z
  .object({
    periodNumber: z
      .number()
      .int()
      .min(1, "Il tempo deve essere tra 1 e 4.")
      .max(FOUR_PERIOD_COUNT, "Il tempo deve essere tra 1 e 4."),
    homeScore: z.number().int().min(0).max(99).nullable(),
    awayScore: z.number().int().min(0).max(99).nullable(),
  })
  .superRefine((value, ctx) => {
    const hasHome = value.homeScore != null;
    const hasAway = value.awayScore != null;
    if (hasHome !== hasAway) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Per ogni tempo inserisci entrambi i gol oppure nessuno (non inserito).",
        path: ["homeScore"],
      });
    }
  });

export const updateAttendanceSchema = z
  .object({
    entries: z.array(attendanceEntrySchema).min(1, "Seleziona almeno un atleta."),
    matchResult: matchResultSchema.optional(),
    periodScores: z.array(periodScoreSchema).max(FOUR_PERIOD_COUNT).optional(),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    for (const [index, entry] of value.entries.entries()) {
      if (seen.has(entry.athleteId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Atleta duplicato nella richiesta.",
          path: ["entries", index, "athleteId"],
        });
      }
      seen.add(entry.athleteId);

      if (entry.status !== "PRESENT") {
        if ((entry.goals ?? 0) > 0 || (entry.assists ?? 0) > 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Gol e assist solo per atleti presenti.",
            path: ["entries", index, "goals"],
          });
        }
        if (entry.goalsConceded != null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Gol subiti solo per portieri presenti.",
            path: ["entries", index, "goalsConceded"],
          });
        }
      }
    }

    if (value.periodScores) {
      const periodSeen = new Set<number>();
      for (const [index, period] of value.periodScores.entries()) {
        if (periodSeen.has(period.periodNumber)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Tempo duplicato nella richiesta.",
            path: ["periodScores", index, "periodNumber"],
          });
        }
        periodSeen.add(period.periodNumber);
      }
    }
  });
