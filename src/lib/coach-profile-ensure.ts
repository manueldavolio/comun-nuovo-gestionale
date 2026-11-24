import type { Prisma } from "@prisma/client";
import { splitFullName } from "@/lib/staff";

type Tx = Prisma.TransactionClient;

/**
 * Crea CoachProfile se manca (idempotente). Non tocca ParentProfile né categorie.
 * update vuoto: non sovrascrive firstName/lastName/phone già presenti.
 */
export async function ensureCoachProfileForUser(
  tx: Tx,
  input: { userId: string; name: string | null | undefined },
): Promise<{ created: boolean }> {
  const existing = await tx.coachProfile.findUnique({
    where: { userId: input.userId },
    select: { id: true },
  });
  if (existing) {
    return { created: false };
  }

  const { firstName, lastName } = splitFullName(input.name ?? "");
  await tx.coachProfile.create({
    data: {
      userId: input.userId,
      firstName: firstName || "Mister",
      lastName: lastName || "Coach",
      phone: "",
    },
  });
  return { created: true };
}
