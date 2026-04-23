import "server-only";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function canManageCategoryForConvocations(params: {
  userId: string;
  role: UserRole;
  categoryId: string;
}) {
  if (params.role === "ADMIN" || params.role === "YOUTH_DIRECTOR") {
    return true;
  }

  if (params.role !== "COACH") {
    return false;
  }

  const coachProfile = await prisma.coachProfile.findUnique({
    where: { userId: params.userId },
    select: { id: true },
  });

  if (!coachProfile) {
    return false;
  }

  const assignment = await prisma.coachCategoryAssignment.findUnique({
    where: {
      coachId_categoryId: {
        coachId: coachProfile.id,
        categoryId: params.categoryId,
      },
    },
    select: { id: true },
  });

  return Boolean(assignment);
}
