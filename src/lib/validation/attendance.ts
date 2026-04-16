import { z } from "zod";
import { AttendanceStatus } from "@prisma/client";

const attendanceEntrySchema = z.object({
  athleteId: z.string().cuid("Atleta non valido."),
  status: z.nativeEnum(AttendanceStatus, { error: "Stato presenza non valido." }),
});

export const updateAttendanceSchema = z
  .object({
    entries: z.array(attendanceEntrySchema).min(1, "Seleziona almeno un atleta."),
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
    }
  });
