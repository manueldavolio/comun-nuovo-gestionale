import { z } from "zod";

export const createParentAthleteLinkRequestSchema = z.object({
  athleteTaxCode: z
    .string()
    .trim()
    .min(8, "Codice fiscale non valido.")
    .max(24, "Codice fiscale non valido."),
  athleteBirthDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data di nascita non valida."),
});

export const reviewParentAthleteLinkRequestSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"], {
    error: "Azione non valida.",
  }),
});
