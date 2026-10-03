import type { UserRole } from "@prisma/client";
import { getCoachCategoryIdsForUser } from "@/lib/attendance";
import { prisma } from "@/lib/prisma";

export async function canManageAthleteCategory(options: {
  userId: string;
  role: UserRole;
  categoryId: string;
}): Promise<boolean> {
  if (options.role === "ADMIN" || options.role === "YOUTH_DIRECTOR") {
    return true;
  }

  if (options.role !== "COACH") {
    return false;
  }

  const coachCategoryIds = await getCoachCategoryIdsForUser(options.userId);
  return coachCategoryIds.includes(options.categoryId);
}

export async function getAthleteCategoryId(athleteId: string): Promise<string | null> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { categoryId: true },
  });
  return athlete?.categoryId ?? null;
}
