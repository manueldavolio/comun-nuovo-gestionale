import { z } from "zod";
import { AttendanceStatus } from "@prisma/client";

const attendanceEntrySchema = z.object({
  athleteId: z.string().cuid("Atleta non valido."),
  status: z.nativeEnum(AttendanceStatus, { error: "Stato presenza non valido." }),
  goals: z.number().int().min(0).max(99).optional(),
  assists: z.number().int().min(0).max(99).optional(),
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

export const updateAttendanceSchema = z
  .object({
    entries: z.array(attendanceEntrySchema).min(1, "Seleziona almeno un atleta."),
    matchResult: matchResultSchema.optional(),
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
      }
    }
  });
