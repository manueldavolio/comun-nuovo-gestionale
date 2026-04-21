import { z } from "zod";

export const userRoleSchema = z.enum(["ADMIN", "YOUTH_DIRECTOR", "COACH", "PARENT"]);

export const updateAdminUserSchema = z
  .object({
    role: userRoleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((payload) => payload.role !== undefined || payload.isActive !== undefined, {
    message: "Indica almeno un campo da aggiornare.",
  });

export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;
