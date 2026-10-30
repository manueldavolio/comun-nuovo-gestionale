import { z } from "zod";

const optionalTrimmed = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

export const upsertFamilyBenefitSchema = z.object({
  name: z.string().trim().min(1, "Nome obbligatorio.").max(140, "Nome troppo lungo."),
  businessName: optionalTrimmed(140, "Attività troppo lunga."),
  description: z.string().trim().min(1, "Descrizione obbligatoria.").max(4000, "Descrizione troppo lunga."),
  discountLabel: optionalTrimmed(120, "Sconto troppo lungo."),
  promoCode: optionalTrimmed(80, "Codice troppo lungo."),
  conditions: optionalTrimmed(4000, "Condizioni troppo lunghe."),
  logoUrl: optionalTrimmed(600, "URL logo troppo lungo."),
  websiteUrl: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || /^https?:\/\/.+/i.test(value), {
      message: "Il link deve iniziare con http:// o https://.",
    }),
  contactInfo: optionalTrimmed(400, "Contatti troppo lunghi."),
  expiresAt: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || !Number.isNaN(Date.parse(value)), {
      message: "Data scadenza non valida.",
    }),
  audience: z.enum(["ALL", "YOUTH", "FIRST_TEAM", "BASE_ACTIVITY"]),
  isPublished: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  priority: z.coerce.number().int().min(0).max(9999),
});

export type UpsertFamilyBenefitInput = z.input<typeof upsertFamilyBenefitSchema>;

export const upsertCompetitionSourceSchema = z.object({
  categoryId: z.string().trim().min(1),
  seasonLabel: z.string().trim().min(1).max(32),
  competitionName: z.string().trim().min(1).max(180),
  groupLabel: optionalTrimmed(80, "Girone troppo lungo."),
  sourceType: z.enum(["NONE", "TUTTOCAMPO", "CRL_LND", "MANUAL"]),
  sourcePageUrl: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || /^https:\/\/.+/i.test(value), {
      message: "URL fonte deve essere https://.",
    }),
  tuttocampoWidgetUuid: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value ? value : null))
    .refine(
      (value) =>
        value === null ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
      { message: "UUID Tuttocampo non valido." },
    ),
  widgetSeasonParam: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || /^\d{4}-\d{2}$/.test(value), {
      message: "Stagione widget non valida (atteso es. 2026-27).",
    }),
  /**
   * Consente di riusare lo stesso UUID su un'altra categoria (scelta admin esplicita).
   * Di default un UUID già collegato a una categoria non può essere riusato.
   */
  allowSharedUuid: z.boolean().optional().default(false),
  widgetStandingsUrl: optionalTrimmed(600, "URL widget classifica troppo lungo."),
  widgetResultsUrl: optionalTrimmed(600, "URL widget risultati troppo lungo."),
  widgetScorersUrl: optionalTrimmed(600, "URL widget marcatori troppo lungo."),
  widgetLastMatchUrl: optionalTrimmed(600, "URL widget ultima partita troppo lungo."),
  widgetNextMatchUrl: optionalTrimmed(600, "URL widget prossima partita troppo lungo."),
  manualStandingsJson: optionalTrimmed(20000, "JSON classifica troppo lungo."),
  sourceNotes: optionalTrimmed(4000, "Note troppo lunghe."),
  lastVerifiedAt: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || !Number.isNaN(Date.parse(value)), {
      message: "Data verifica non valida.",
    }),
  isActive: z.boolean(),
});

export type UpsertCompetitionSourceInput = z.input<typeof upsertCompetitionSourceSchema>;
