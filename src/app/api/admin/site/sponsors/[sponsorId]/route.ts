import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSiteWebAdminApi } from "@/lib/site-cms-server";
import { upsertSiteSponsorSchema } from "@/lib/validation/site";

export async function PUT(
  request: Request,
  context: { params: Promise<{ sponsorId: string }> },
) {
  const { errorResponse } = await requireSiteWebAdminApi();
  if (errorResponse) {
    return errorResponse;
  }

  const { sponsorId } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = upsertSiteSponsorSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const sponsor = await prisma.siteSponsor.findUnique({
    where: { id: sponsorId },
    select: { id: true },
  });
  if (!sponsor) {
    return NextResponse.json({ error: "Sponsor non trovato." }, { status: 404 });
  }

  try {
    await prisma.siteSponsor.update({
      where: { id: sponsorId },
      data: {
        name: parsed.data.name,
        category: parsed.data.category,
        logoUrl: parsed.data.logoUrl,
        websiteUrl: parsed.data.websiteUrl,
        isVisible: parsed.data.isVisible,
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Errore durante l'aggiornamento dello sponsor." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ sponsorId: string }> },
) {
  const { errorResponse } = await requireSiteWebAdminApi();
  if (errorResponse) {
    return errorResponse;
  }

  const { sponsorId } = await context.params;

  const sponsor = await prisma.siteSponsor.findUnique({
    where: { id: sponsorId },
    select: { id: true },
  });
  if (!sponsor) {
    return NextResponse.json({ error: "Sponsor non trovato." }, { status: 404 });
  }

  try {
    await prisma.siteSponsor.delete({ where: { id: sponsorId } });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Errore durante l'eliminazione dello sponsor." }, { status: 500 });
  }
}
