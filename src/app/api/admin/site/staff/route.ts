import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSiteWebAdminApi } from "@/lib/site-cms-server";
import { upsertSiteStaffSchema } from "@/lib/validation/site";

export async function POST(request: Request) {
  const { errorResponse } = await requireSiteWebAdminApi();
  if (errorResponse) {
    return errorResponse;
  }

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

  try {
    const created = await prisma.siteStaffMember.create({
      data: {
        name: parsed.data.name,
        role: parsed.data.role,
        category: parsed.data.category,
        description: parsed.data.description,
        photoUrl: parsed.data.photoUrl,
        isVisible: parsed.data.isVisible,
      },
      select: { id: true },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore durante la creazione del membro staff." }, { status: 500 });
  }
}
