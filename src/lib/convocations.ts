import "server-only";
import type { UserRole } from "@prisma/client";
import { canManageCategoryForEvents } from "@/lib/category-event-access";

export async function canManageCategoryForConvocations(params: {
  userId: string;
  role: UserRole;
  categoryId: string;
}) {
  return canManageCategoryForEvents({
    userId: params.userId,
    role: params.role,
    categoryId: params.categoryId,
  });
}
