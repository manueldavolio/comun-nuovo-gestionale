import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { getAuthSession } from "@/lib/auth";
import {
  buildPasswordHashUpdateData,
  generateTemporaryPassword,
} from "@/lib/admin-password-reset";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { userId } = await context.params;
  if (!userId) {
    return NextResponse.json({ error: "ID utente non valido." }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isActive: true,
    },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "Utente non trovato." }, { status: 404 });
  }

  const temporaryPassword = generateTemporaryPassword(16);
  const passwordHash = await hash(temporaryPassword, 12);

  try {
    await prisma.user.update({
      where: { id: targetUser.id },
      data: buildPasswordHashUpdateData(passwordHash),
    });
  } catch {
    return NextResponse.json(
      { error: "Errore durante il reset della password." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    temporaryPassword,
    isActive: targetUser.isActive,
  });
}
