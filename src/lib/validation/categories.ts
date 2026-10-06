import { z } from "zod";
import { PLAYERS_PER_SIDE_VALUES } from "@/lib/category-format";

export const upsertCategorySchema = z.object({
  name: z.string().trim().min(1, "Nome categoria obbligatorio.").max(80, "Nome categoria troppo lungo."),
  birthYearsLabel: z
    .string()
    .trim()
    .min(1, "Annata / descrizione obbligatoria.")
    .max(120, "Annata / descrizione troppo lunga."),
  isActive: z.boolean(),
  playersPerSide: z
    .number({ error: "Formato partita obbligatorio." })
    .int()
    .refine(
      (value): value is (typeof PLAYERS_PER_SIDE_VALUES)[number] =>
        (PLAYERS_PER_SIDE_VALUES as readonly number[]).includes(value),
      { message: "Formato partita non valido (5, 7, 9 o 11)." },
    ),
});

export type UpsertCategoryInput = z.infer<typeof upsertCategorySchema>;
