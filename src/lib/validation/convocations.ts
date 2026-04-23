import { ConvocationResponseStatus } from "@prisma/client";
import { z } from "zod";

const cuidSchema = z.string().cuid("Identificativo non valido.");

export const saveConvocationSchema = z
  .object({
    eventId: cuidSchema,
    athleteIds: z.array(cuidSchema).min(1, "Seleziona almeno un atleta convocato."),
    notes: z.string().trim().max(1000, "Note troppo lunghe").optional().default(""),
    sendEmail: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    for (const [index, athleteId] of value.athleteIds.entries()) {
      if (seen.has(athleteId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Atleta duplicato nella convocazione.",
          path: ["athleteIds", index],
        });
      }
      seen.add(athleteId);
    }
  });

export const respondConvocationSchema = z.object({
  responseStatus: z.enum([ConvocationResponseStatus.PRESENT, ConvocationResponseStatus.ABSENT], {
    error: "Stato risposta non valido.",
  }),
});
