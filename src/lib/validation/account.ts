import { z } from "zod";
import { newPasswordSchema, validateNewPasswordStrength } from "@/lib/validation/password-policy";

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Inserisci la password attuale."),
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, "Conferma la nuova password."),
  })
  .superRefine(({ currentPassword, newPassword, confirmPassword }, ctx) => {
    const strengthError = validateNewPasswordStrength(newPassword);
    if (strengthError) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: strengthError,
      });
    }

    if (newPassword !== confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Le password non coincidono.",
      });
    }

    if (currentPassword && newPassword && currentPassword === newPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: "La nuova password deve essere diversa da quella attuale.",
      });
    }
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
