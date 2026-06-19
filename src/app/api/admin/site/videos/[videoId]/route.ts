import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSiteWebAdminApi } from "@/lib/site-cms-server";
import { upsertSiteVideoSchema } from "@/lib/validation/site";

export async function PUT(
  request: Request,
  context: { params: Promise<{ videoId: string }> },
) {
  const { errorResponse } = await requireSiteWebAdminApi();
  if (errorResponse) {
    return errorResponse;
  }

  const { videoId } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = upsertSiteVideoSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const video = await prisma.siteVideo.findUnique({
    where: { id: videoId },
    select: { id: true },
  });
  if (!video) {
    return NextResponse.json({ error: "Video non trovato." }, { status: 404 });
  }

  try {
    await prisma.siteVideo.update({
      where: { id: videoId },
      data: {
        title: parsed.data.title,
        youtubeUrl: parsed.data.youtubeUrl,
        description: parsed.data.description,
        isVisible: parsed.data.isVisible,
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Errore durante l'aggiornamento del video." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ videoId: string }> },
) {
  const { errorResponse } = await requireSiteWebAdminApi();
  if (errorResponse) {
    return errorResponse;
  }

  const { videoId } = await context.params;

  const video = await prisma.siteVideo.findUnique({
    where: { id: videoId },
    select: { id: true },
  });
  if (!video) {
    return NextResponse.json({ error: "Video non trovato." }, { status: 404 });
  }

  try {
    await prisma.siteVideo.delete({ where: { id: videoId } });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Errore durante l'eliminazione del video." }, { status: 500 });
  }
}
