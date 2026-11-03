import { z } from "zod";
import { DocumentType as DocumentTypeEnum } from "@prisma/client";
import {
  archiveDocumentPathErrorMessage,
  validateArchiveDocumentFilePath,
} from "@/lib/archive-document-path";

const dateInputRegex = /^(\d{4})-(\d{2})-(\d{2})$/;

const documentExpiryDateSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .refine((value) => {
    if (value === undefined || value === null || value.trim() === "") return true;
    return dateInputRegex.test(value);
  }, "Data scadenza non valida.");

const archiveFilePathSchema = z
  .string()
  .trim()
  .min(1, "FilePath obbligatorio (per ora inserisci un nome/placeholder).")
  .superRefine((value, ctx) => {
    const check = validateArchiveDocumentFilePath(value);
    if (!check.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: archiveDocumentPathErrorMessage(check.code),
      });
    }
  });

export const upsertDocumentSchema = z.object({
  athleteId: z.string().cuid("Atleta non valido."),
  type: z.nativeEnum(DocumentTypeEnum),
  title: z.string().trim().min(1, "Titolo documento obbligatorio.").max(120, "Titolo troppo lungo."),
  filePath: archiveFilePathSchema,
  expiryDate: documentExpiryDateSchema,
  notes: z.string().trim().max(1000, "Note troppo lunghe.").optional().nullable(),
});

export type UpsertDocumentInput = z.infer<typeof upsertDocumentSchema>;

