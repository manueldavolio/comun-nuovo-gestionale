import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSiteWebAdminApi } from "@/lib/site-cms-server";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ imageId: string }> },
) {
  const { errorResponse } = await requireSiteWebAdminApi();
  if (errorResponse) {
    return errorResponse;
  }

  const { imageId } = await context.params;

  const image = await prisma.siteGalleryImage.findUnique({
    where: { id: imageId },
    select: { id: true },
  });
  if (!image) {
    return NextResponse.json({ error: "Immagine non trovata." }, { status: 404 });
  }

  try {
    await prisma.siteGalleryImage.delete({ where: { id: imageId } });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Errore durante l'eliminazione dell'immagine." }, { status: 500 });
  }
}
