import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSiteWebAdminApi } from "@/lib/site-cms-server";
import { addSiteGalleryImagesSchema } from "@/lib/validation/site";

export async function POST(
  request: Request,
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

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = addSiteGalleryImagesSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  try {
    const created = await prisma.siteGalleryImage.createMany({
      data: parsed.data.images.map((image, index) => ({
        albumId,
        imageUrl: image.imageUrl,
        alt: image.alt,
        sortOrder: index,
      })),
    });

    return NextResponse.json({ success: true, data: { count: created.count } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore durante il salvataggio delle immagini." }, { status: 500 });
  }
}
