import { z } from "zod";

export const registerSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, "Il nome e obbligatorio."),
    lastName: z
      .string()
      .trim()
      .min(1, "Il cognome e obbligatorio."),
    email: z.email("Inserisci un'email valida."),
    password: z
      .string()
      .min(6, "La password deve contenere almeno 6 caratteri."),
    confirmPassword: z.string(),
  })
  .superRefine(({ password, confirmPassword }, ctx) => {
    if (password !== confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Le password non coincidono.",
      });
    }
  });

export type RegisterInput = z.infer<typeof registerSchema>;
