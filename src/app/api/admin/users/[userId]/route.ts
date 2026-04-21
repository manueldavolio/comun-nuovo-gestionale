import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateAdminUserSchema } from "@/lib/validation/users";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = updateAdminUserSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const { userId } = await context.params;
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      isActive: true,
    },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "Utente non trovato." }, { status: 404 });
  }

  const nextRole = parsed.data.role ?? targetUser.role;
  const nextIsActive = parsed.data.isActive ?? targetUser.isActive;

  if (session.user.id === targetUser.id && (!nextIsActive || nextRole !== "ADMIN")) {
    return NextResponse.json(
      { error: "Non puoi disattivare o rimuovere il tuo ruolo admin." },
      { status: 400 },
    );
  }

  const isAdminLosingPrivilegies = targetUser.role === "ADMIN" && (nextRole !== "ADMIN" || !nextIsActive);
  if (isAdminLosingPrivilegies) {
    const activeAdmins = await prisma.user.count({
      where: {
        role: "ADMIN",
        isActive: true,
      },
    });
    if (activeAdmins <= 1) {
      return NextResponse.json(
        { error: "Deve rimanere almeno un admin attivo nel sistema." },
        { status: 400 },
      );
    }
  }

  await prisma.user.update({
    where: { id: targetUser.id },
    data: {
      role: nextRole,
      isActive: nextIsActive,
    },
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
