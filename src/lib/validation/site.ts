import { z } from "zod";
import {
  SITE_NEWS_CATEGORIES,
  SITE_STAFF_CATEGORIES,
  extractYoutubeId,
} from "@/lib/site-cms";

const optionalTrimmedString = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

const optionalImageUrl = optionalTrimmedString(600, "URL immagine troppo lungo.");

export const upsertSitePlayerSchema = z.object({
  name: z.string().trim().min(1, "Nome giocatore obbligatorio.").max(120, "Nome troppo lungo."),
  role: z.enum(["PORTIERE", "DIFENSORE", "CENTROCAMPISTA", "ATTACCANTE"], {
    message: "Seleziona un ruolo valido.",
  }),
  team: z.enum(["PRIMA_SQUADRA", "FEMMINILE", "UNDER_19", "UNDER_17", "UNDER_15", "CALCIO_A_5_C2"], {
    message: "Seleziona una squadra valida.",
  }),
  shirtNumber: z
    .union([
      z.coerce
        .number()
        .int("Numero maglia non valido.")
        .min(1, "Numero maglia minimo 1.")
        .max(99, "Numero maglia massimo 99."),
      z.literal("").transform(() => null),
      z.null(),
    ])
    .optional()
    .transform((value) => (typeof value === "number" ? value : null)),
  description: optionalTrimmedString(600, "Descrizione troppo lunga (max 600 caratteri)."),
  photoUrl: optionalImageUrl,
  isVisible: z.boolean(),
});

export type UpsertSitePlayerInput = z.input<typeof upsertSitePlayerSchema>;

export const upsertSiteStaffSchema = z.object({
  name: z.string().trim().min(1, "Nome obbligatorio.").max(120, "Nome troppo lungo."),
  role: z.string().trim().min(1, "Ruolo obbligatorio.").max(120, "Ruolo troppo lungo."),
  category: z.enum(SITE_STAFF_CATEGORIES, { message: "Seleziona una categoria valida." }),
  description: optionalTrimmedString(600, "Descrizione troppo lunga (max 600 caratteri)."),
  photoUrl: optionalImageUrl,
  isVisible: z.boolean(),
});

export type UpsertSiteStaffInput = z.input<typeof upsertSiteStaffSchema>;

export const upsertSiteNewsSchema = z.object({
  title: z.string().trim().min(1, "Titolo obbligatorio.").max(180, "Titolo troppo lungo."),
  subtitle: optionalTrimmedString(300, "Sottotitolo troppo lungo (max 300 caratteri)."),
  content: z.string().trim().min(1, "Testo della news obbligatorio."),
  coverImageUrl: optionalImageUrl,
  category: z.enum(SITE_NEWS_CATEGORIES, { message: "Seleziona una categoria valida." }),
  published: z.boolean(),
  publishedAt: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || !Number.isNaN(Date.parse(value)), {
      message: "Data di pubblicazione non valida.",
    }),
});

export type UpsertSiteNewsInput = z.input<typeof upsertSiteNewsSchema>;

export const upsertSiteSponsorSchema = z.object({
  name: z.string().trim().min(1, "Nome sponsor obbligatorio.").max(140, "Nome troppo lungo."),
  category: z.enum(["MAIN", "GOLD", "PARTNER", "TECHNICAL"], {
    message: "Seleziona una categoria valida.",
  }),
  logoUrl: optionalImageUrl,
  websiteUrl: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || /^https?:\/\/.+/i.test(value), {
      message: "Il link deve iniziare con http:// o https://.",
    }),
  isVisible: z.boolean(),
});

export type UpsertSiteSponsorInput = z.input<typeof upsertSiteSponsorSchema>;

export const upsertSiteGalleryAlbumSchema = z.object({
  title: z.string().trim().min(1, "Titolo album obbligatorio.").max(140, "Titolo troppo lungo."),
  date: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || !Number.isNaN(Date.parse(value)), {
      message: "Data album non valida.",
    }),
  isVisible: z.boolean(),
});

export type UpsertSiteGalleryAlbumInput = z.input<typeof upsertSiteGalleryAlbumSchema>;

export const addSiteGalleryImagesSchema = z.object({
  images: z
    .array(
      z.object({
        imageUrl: z.string().trim().min(1, "URL immagine mancante.").max(600, "URL immagine troppo lungo."),
        alt: optionalTrimmedString(200, "Descrizione immagine troppo lunga."),
      }),
    )
    .min(1, "Aggiungi almeno un'immagine."),
});

export type AddSiteGalleryImagesInput = z.input<typeof addSiteGalleryImagesSchema>;

export const upsertSiteVideoSchema = z.object({
  title: z.string().trim().min(1, "Titolo video obbligatorio.").max(160, "Titolo troppo lungo."),
  youtubeUrl: z
    .string()
    .trim()
    .min(1, "Link YouTube obbligatorio.")
    .max(400, "Link troppo lungo.")
    .refine((value) => extractYoutubeId(value) !== null, {
      message: "Link YouTube non valido (es. https://www.youtube.com/watch?v=...).",
    }),
  description: optionalTrimmedString(600, "Descrizione troppo lunga (max 600 caratteri)."),
  isVisible: z.boolean(),
});

export type UpsertSiteVideoInput = z.input<typeof upsertSiteVideoSchema>;

export const upsertSiteSettingsSchema = z.object({
  foundationYear: z.coerce
    .number()
    .int("Anno non valido.")
    .min(1900, "Anno non valido.")
    .max(2100, "Anno non valido."),
  teamsCount: z.string().trim().min(1, "Numero squadre obbligatorio.").max(20, "Valore troppo lungo."),
  membersCount: z.string().trim().min(1, "Numero tesserati obbligatorio.").max(20, "Valore troppo lungo."),
  fieldsCount: z.string().trim().min(1, "Numero campi obbligatorio.").max(20, "Valore troppo lungo."),
});

export type UpsertSiteSettingsInput = z.input<typeof upsertSiteSettingsSchema>;
