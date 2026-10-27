import "server-only";
import type { UserRole } from "@prisma/client";
import { canManageEventForStaff } from "@/lib/category-event-access";
import { prisma } from "@/lib/prisma";

export async function getCoachCategoryIdsForUser(userId: string) {
  const links = await prisma.coachCategoryAssignment.findMany({
    where: {
      coach: {
        userId,
      },
    },
    select: {
      categoryId: true,
    },
  });

  return links.map((link) => link.categoryId);
}

export async function canManageEventAttendance(params: {
  userId: string;
  role: UserRole;
  eventId: string;
}) {
  return canManageEventForStaff({
    userId: params.userId,
    role: params.role,
    eventId: params.eventId,
  });
}
