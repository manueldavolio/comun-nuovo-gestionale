import { z } from "zod";

export const upsertCategorySchema = z.object({
  name: z.string().trim().min(1, "Nome categoria obbligatorio.").max(80, "Nome categoria troppo lungo."),
  birthYearsLabel: z
    .string()
    .trim()
    .min(1, "Annata / descrizione obbligatoria.")
    .max(120, "Annata / descrizione troppo lunga."),
  isActive: z.boolean(),
});

export type UpsertCategoryInput = z.infer<typeof upsertCategorySchema>;
