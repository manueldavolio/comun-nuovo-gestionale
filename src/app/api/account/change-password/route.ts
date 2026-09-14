import { NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { getAuthSession } from "@/lib/auth";
import { buildPasswordHashUpdateData } from "@/lib/admin-password-reset";
import { prisma } from "@/lib/prisma";
import { changePasswordSchema } from "@/lib/validation/account";

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = changePasswordSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      isActive: true,
      passwordHash: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Utente non trovato." }, { status: 404 });
  }

  if (!user.isActive) {
    return NextResponse.json({ error: "Account disattivato." }, { status: 403 });
  }

  const currentMatches = await compare(parsed.data.currentPassword, user.passwordHash);
  if (!currentMatches) {
    return NextResponse.json({ error: "Password attuale non corretta." }, { status: 400 });
  }

  const passwordHash = await hash(parsed.data.newPassword, 12);

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: buildPasswordHashUpdateData(passwordHash),
    });
  } catch {
    return NextResponse.json(
      { error: "Errore durante l'aggiornamento della password." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
