import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSiteWebAdminApi } from "@/lib/site-cms-server";
import { upsertSitePlayerSchema } from "@/lib/validation/site";

export async function PUT(
  request: Request,
  context: { params: Promise<{ playerId: string }> },
) {
  const { errorResponse } = await requireSiteWebAdminApi();
  if (errorResponse) {
    return errorResponse;
  }

  const { playerId } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = upsertSitePlayerSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const player = await prisma.sitePlayer.findUnique({
    where: { id: playerId },
    select: { id: true },
  });
  if (!player) {
    return NextResponse.json({ error: "Giocatore non trovato." }, { status: 404 });
  }

  try {
    await prisma.sitePlayer.update({
      where: { id: playerId },
      data: {
        name: parsed.data.name,
        role: parsed.data.role,
        team: parsed.data.team,
        shirtNumber: parsed.data.shirtNumber,
        description: parsed.data.description,
        photoUrl: parsed.data.photoUrl,
        isVisible: parsed.data.isVisible,
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Errore durante l'aggiornamento del giocatore." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ playerId: string }> },
) {
  const { errorResponse } = await requireSiteWebAdminApi();
  if (errorResponse) {
    return errorResponse;
  }

  const { playerId } = await context.params;

  const player = await prisma.sitePlayer.findUnique({
    where: { id: playerId },
    select: { id: true },
  });
  if (!player) {
    return NextResponse.json({ error: "Giocatore non trovato." }, { status: 404 });
  }

  try {
    await prisma.sitePlayer.delete({ where: { id: playerId } });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Errore durante l'eliminazione del giocatore." }, { status: 500 });
  }
}
