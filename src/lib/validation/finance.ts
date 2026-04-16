import { z } from "zod";
import { AccountingEntryType as AccountingEntryTypeEnum } from "@prisma/client";
import { FINANCE_CATEGORY_VALUES } from "@/lib/finance";

const dateInputRegex = /^(\d{4})-(\d{2})-(\d{2})$/;

const categorySchema = z.enum(FINANCE_CATEGORY_VALUES, {
  error: "Categoria non valida.",
});

export const createFinanceEntrySchema = z.object({
  type: z.nativeEnum(AccountingEntryTypeEnum),
  category: categorySchema,
  amount: z.coerce.number().gt(0, "Importo deve essere maggiore di 0."),
  description: z
    .string()
    .trim()
    .min(3, "Descrizione troppo corta.")
    .max(300, "Descrizione troppo lunga."),
  date: z
    .string()
    .trim()
    .regex(dateInputRegex, "Data non valida."),
  isForecast: z.boolean().default(false),
});

export type CreateFinanceEntryInput = z.infer<typeof createFinanceEntrySchema>;
