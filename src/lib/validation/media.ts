import { z } from "zod";
import { MediaType as MediaTypeEnum } from "@prisma/client";

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

export const createMediaItemSchema = z
  .object({
    title: z.string().trim().min(1, "Titolo obbligatorio.").max(140, "Titolo troppo lungo."),
    description: z.string().trim().max(1000, "Descrizione troppo lunga.").optional().nullable(),
    mediaType: z.nativeEnum(MediaTypeEnum),
    categoryId: z.string().cuid("Categoria non valida."),
    filePath: z.string().trim().optional().nullable(),
    mediaUrl: z.string().trim().url("URL media non valido.").optional().nullable(),
    publishedAt: publicationDateSchema,
  })
  .superRefine((value, ctx) => {
    const hasFilePath = Boolean(value.filePath?.trim());
    const hasMediaUrl = Boolean(value.mediaUrl?.trim());
    if (!hasFilePath && !hasMediaUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mediaUrl"],
        message: "Inserisci almeno un mediaUrl o un filePath.",
      });
    }
  });

export type CreateMediaItemInput = z.infer<typeof createMediaItemSchema>;
