import "server-only";
import type { UserRole } from "@prisma/client";
import { canManageEventAttendance } from "@/lib/attendance";
import { listManageableCategoryIdsForEvents } from "@/lib/category-event-access";
import { prisma } from "@/lib/prisma";

export async function assertStaffCanManageEvent(params: {
  userId: string;
  role: UserRole;
  eventId: string;
}): Promise<
  | { ok: true }
  | { ok: false; status: 401 | 403 | 404; error: string }
> {
  if (
    params.role !== "ADMIN" &&
    params.role !== "YOUTH_DIRECTOR" &&
    params.role !== "COACH"
  ) {
    return { ok: false, status: 403, error: "Operazione non consentita." };
  }

  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    select: { id: true },
  });
  if (!event) {
    return { ok: false, status: 404, error: "Evento non trovato." };
  }

  const canManage = await canManageEventAttendance({
    userId: params.userId,
    role: params.role,
    eventId: params.eventId,
  });
  if (!canManage) {
    return {
      ok: false,
      status: 403,
      error: "Non puoi gestire questo evento.",
    };
  }

  return { ok: true };
}

export async function getStaffAllowedCategoryIds(params: {
  userId: string;
  role: UserRole;
}): Promise<string[]> {
  return listManageableCategoryIdsForEvents({
    userId: params.userId,
    role: params.role,
    activeOnly: true,
  });
}
