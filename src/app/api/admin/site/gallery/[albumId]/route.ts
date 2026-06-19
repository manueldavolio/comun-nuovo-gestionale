import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSiteWebAdminApi } from "@/lib/site-cms-server";
import { upsertSiteGalleryAlbumSchema } from "@/lib/validation/site";

export async function PUT(
  request: Request,
  context: { params: Promise<{ albumId: string }> },
) {
  const { errorResponse } = await requireSiteWebAdminApi();
  if (errorResponse) {
    return errorResponse;
  }

  const { albumId } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = upsertSiteGalleryAlbumSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const album = await prisma.siteGalleryAlbum.findUnique({
    where: { id: albumId },
    select: { id: true },
  });
  if (!album) {
    return NextResponse.json({ error: "Album non trovato." }, { status: 404 });
  }

  try {
    await prisma.siteGalleryAlbum.update({
      where: { id: albumId },
      data: {
        title: parsed.data.title,
        date: parsed.data.date ? new Date(parsed.data.date) : null,
        isVisible: parsed.data.isVisible,
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Errore durante l'aggiornamento dell'album." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ albumId: string }> },
) {
  const { errorResponse } = await requireSiteWebAdminApi();
  if (errorResponse) {
    return errorResponse;
  }

  const { albumId } = await context.params;

  const album = await prisma.siteGalleryAlbum.findUnique({
    where: { id: albumId },
    select: { id: true },
  });
  if (!album) {
    return NextResponse.json({ error: "Album non trovato." }, { status: 404 });
  }

  try {
    // Le immagini collegate vengono eliminate a cascata (onDelete: Cascade).
    await prisma.siteGalleryAlbum.delete({ where: { id: albumId } });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Errore durante l'eliminazione dell'album." }, { status: 500 });
  }
}
