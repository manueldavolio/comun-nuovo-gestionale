import { z } from "zod";

const dateInputRegex = /^(\d{4})-(\d{2})-(\d{2})$/;

const visitDateSchema = z
  .string()
  .trim()
  .min(1, "Data visita obbligatoria.")
  .refine((value) => dateInputRegex.test(value), "Data visita non valida.");

const expiryDateSchema = z
  .string()
  .trim()
  .min(1, "Data scadenza obbligatoria.")
  .refine((value) => dateInputRegex.test(value), "Data scadenza non valida.");

export const upsertMedicalVisitSchema = z
  .object({
    athleteId: z.string().cuid("Atleta non valido."),
    visitDate: visitDateSchema,
    expiryDate: expiryDateSchema,
    notes: z.string().trim().max(1000, "Note troppo lunghe.").optional().nullable(),
    certificateFilePath: z.string().trim().max(2000, "Percorso file certificato troppo lungo.").optional().nullable(),
  })
  .superRefine((value, ctx) => {
    // Basic sanity: expiryDate should not be before visitDate.
    const partsVisit = value.visitDate.split("-").map(Number);
    const partsExpiry = value.expiryDate.split("-").map(Number);
    if (partsVisit.length !== 3 || partsExpiry.length !== 3) return;

    const visitMs = Date.UTC(partsVisit[0], partsVisit[1] - 1, partsVisit[2], 0, 0, 0);
    const expiryMs = Date.UTC(partsExpiry[0], partsExpiry[1] - 1, partsExpiry[2], 0, 0, 0);
    if (expiryMs < visitMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiryDate"],
        message: "La data scadenza deve essere uguale o successiva alla data visita.",
      });
    }
  });

export type UpsertMedicalVisitInput = z.infer<typeof upsertMedicalVisitSchema>;

