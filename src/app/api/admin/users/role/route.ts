import type { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLE_OPTIONS: UserRole[] = ["ADMIN", "YOUTH_DIRECTOR", "COACH", "PARENT"];

type RoleUpdatePayload = {
  userId?: unknown;
  role?: unknown;
};

function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && ROLE_OPTIONS.includes(value as UserRole);
}

export async function PATCH(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  let payload: RoleUpdatePayload;
  try {
    payload = (await request.json()) as RoleUpdatePayload;
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const userId = typeof payload.userId === "string" ? payload.userId.trim() : "";
  const role = payload.role;

  if (!userId || !isUserRole(role)) {
    return NextResponse.json({ error: "userId o role non validi." }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "Utente non trovato." }, { status: 404 });
  }

  if (targetUser.role === role) {
    return NextResponse.json({ success: true }, { status: 200 });
  }

  await prisma.user.update({
    where: { id: targetUser.id },
    data: { role },
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
