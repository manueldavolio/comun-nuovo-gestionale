import { z } from "zod";
import { AnnouncementAudience as AnnouncementAudienceEnum } from "@prisma/client";

const dateInputRegex = /^(\d{4})-(\d{2})-(\d{2})$/;

const publicationDateSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .refine((value) => {
    if (value === undefined || value === null || value.trim() === "") return true;
    return dateInputRegex.test(value);
  }, "Data pubblicazione non valida.");

export const createAnnouncementSchema = z
  .object({
    title: z.string().trim().min(1, "Titolo obbligatorio.").max(140, "Titolo troppo lungo."),
    content: z.string().trim().min(1, "Contenuto obbligatorio.").max(4000, "Contenuto troppo lungo."),
    audience: z.nativeEnum(AnnouncementAudienceEnum),
    categoryId: z.string().cuid("Categoria non valida.").optional().nullable(),
    publishedAt: publicationDateSchema,
    sendEmail: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.audience === "CATEGORY_ONLY" && !value.categoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryId"],
        message: "La categoria e obbligatoria per audience CATEGORY_ONLY.",
      });
    }
  });

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
