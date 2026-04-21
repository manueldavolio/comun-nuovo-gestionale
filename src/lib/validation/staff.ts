import { z } from "zod";

export const staffRoleSchema = z.enum(["ADMIN", "YOUTH_DIRECTOR", "COACH"]);

export const upsertStaffSchema = z.object({
  firstName: z.string().trim().min(1, "Il nome e obbligatorio.").max(60, "Nome troppo lungo."),
  lastName: z.string().trim().min(1, "Il cognome e obbligatorio.").max(80, "Cognome troppo lungo."),
  email: z.email("Inserisci un'email valida."),
  role: staffRoleSchema,
  categoryIds: z.array(z.string().trim().min(1)).max(50, "Troppe categorie assegnate."),
});

export type UpsertStaffInput = z.infer<typeof upsertStaffSchema>;
