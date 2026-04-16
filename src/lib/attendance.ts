import "server-only";
import type { UserRole } from "@/generated/prisma/enums";
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
  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    select: {
      id: true,
      categoryId: true,
    },
  });

  if (!event) {
    return false;
  }

  if (params.role === "ADMIN" || params.role === "YOUTH_DIRECTOR") {
    return true;
  }

  if (params.role !== "COACH" || !event.categoryId) {
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
        categoryId: event.categoryId,
      },
    },
    select: { id: true },
  });

  return Boolean(assignment);
}
