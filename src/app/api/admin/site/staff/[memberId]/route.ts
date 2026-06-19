import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSiteWebAdminApi } from "@/lib/site-cms-server";
import { upsertSiteStaffSchema } from "@/lib/validation/site";

export async function PUT(
  request: Request,
  context: { params: Promise<{ memberId: string }> },
) {
  const { errorResponse } = await requireSiteWebAdminApi();
  if (errorResponse) {
    return errorResponse;
  }

  const { memberId } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = upsertSiteStaffSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const member = await prisma.siteStaffMember.findUnique({
    where: { id: memberId },
    select: { id: true },
  });
  if (!member) {
    return NextResponse.json({ error: "Membro staff non trovato." }, { status: 404 });
  }

  try {
    await prisma.siteStaffMember.update({
      where: { id: memberId },
      data: {
        name: parsed.data.name,
        role: parsed.data.role,
        category: parsed.data.category,
        description: parsed.data.description,
        photoUrl: parsed.data.photoUrl,
        isVisible: parsed.data.isVisible,
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Errore durante l'aggiornamento del membro staff." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ memberId: string }> },
) {
  const { errorResponse } = await requireSiteWebAdminApi();
  if (errorResponse) {
    return errorResponse;
  }

  const { memberId } = await context.params;

  const member = await prisma.siteStaffMember.findUnique({
    where: { id: memberId },
    select: { id: true },
  });
  if (!member) {
    return NextResponse.json({ error: "Membro staff non trovato." }, { status: 404 });
  }

  try {
    await prisma.siteStaffMember.delete({ where: { id: memberId } });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Errore durante l'eliminazione del membro staff." }, { status: 500 });
  }
}
