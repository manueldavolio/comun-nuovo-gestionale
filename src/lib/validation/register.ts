import { z } from "zod";
import { newPasswordSchema, validateNewPasswordStrength } from "@/lib/validation/password-policy";

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
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .superRefine(({ password, confirmPassword }, ctx) => {
    const strengthError = validateNewPasswordStrength(password);
    if (strengthError) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: strengthError,
      });
    }
    if (password !== confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Le password non coincidono.",
      });
    }
  });

export type RegisterInput = z.infer<typeof registerSchema>;
