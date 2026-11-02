import { z } from "zod";

/** Policy applicata solo a password nuove (register / change / reset). */
export const NEW_PASSWORD_MIN_LENGTH = 10;

export function validateNewPasswordStrength(password: string): string | null {
  if (password.length < NEW_PASSWORD_MIN_LENGTH) {
    return `La password deve contenere almeno ${NEW_PASSWORD_MIN_LENGTH} caratteri.`;
  }
  if (!/[A-Za-z]/.test(password)) {
    return "La password deve contenere almeno una lettera.";
  }
  if (!/\d/.test(password)) {
    return "La password deve contenere almeno un numero.";
  }
  return null;
}

export const newPasswordSchema = z
  .string()
  .min(NEW_PASSWORD_MIN_LENGTH, `La password deve contenere almeno ${NEW_PASSWORD_MIN_LENGTH} caratteri.`)
  .superRefine((value, ctx) => {
    const message = validateNewPasswordStrength(value);
    if (message && message.includes("lettera")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    } else if (message && message.includes("numero")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    }
  });
