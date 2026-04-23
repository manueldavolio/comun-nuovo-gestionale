import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const dateTimeLocalSchema = z
  .string()
  .trim()
  .min(1, "Data e ora obbligatorie")
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Data e ora non valide");

const dateSchema = z
  .string()
  .trim()
  .min(1, "Data obbligatoria")
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00`).getTime()), "Data non valida");

export const createEventSchema = z.object({
  title: z.string().trim().min(3, "Titolo troppo corto").max(120, "Titolo troppo lungo"),
  type: z.enum(["TRAINING", "LEAGUE_MATCH", "TOURNAMENT"]),
  startAt: dateTimeLocalSchema,
  location: z.string().trim().max(120, "Luogo troppo lungo").optional().default(""),
  categoryId: z.string().trim().min(1, "Categoria obbligatoria"),
  notes: z.string().trim().max(1000, "Note troppo lunghe").optional().default(""),
  sendEmail: z.boolean().optional().default(false),
});

export const bulkTrainingSchema = z
  .object({
    categoryId: z.string().trim().min(1, "Categoria obbligatoria"),
    weekdays: z
      .array(z.number().int().min(0).max(6))
      .min(1, "Seleziona almeno un giorno")
      .max(7),
    startDate: dateSchema,
    endDate: dateSchema,
    time: z.string().regex(timeRegex, "Orario non valido"),
    location: z.string().trim().max(120, "Luogo troppo lungo").optional().default(""),
    notes: z.string().trim().max(1000, "Note troppo lunghe").optional().default(""),
  })
  .refine(
    (value) => new Date(`${value.endDate}T00:00:00`).getTime() >= new Date(`${value.startDate}T00:00:00`).getTime(),
    {
      path: ["endDate"],
      message: "La data finale deve essere successiva o uguale alla data iniziale",
    },
  );

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type BulkTrainingInput = z.infer<typeof bulkTrainingSchema>;
