import { z } from "zod";

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Inserisci la password attuale."),
    newPassword: z
      .string()
      .min(6, "La nuova password deve contenere almeno 6 caratteri."),
    confirmPassword: z.string().min(1, "Conferma la nuova password."),
  })
  .superRefine(({ currentPassword, newPassword, confirmPassword }, ctx) => {
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
