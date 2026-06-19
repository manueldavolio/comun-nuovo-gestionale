import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSiteWebAdminApi } from "@/lib/site-cms-server";
import { upsertSiteSettingsSchema } from "@/lib/validation/site";

export async function PUT(request: Request) {
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

  const parsed = upsertSiteSettingsSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  try {
    await prisma.siteSettings.upsert({
      where: { id: "main" },
      create: {
        id: "main",
        foundationYear: parsed.data.foundationYear,
        teamsCount: parsed.data.teamsCount,
        membersCount: parsed.data.membersCount,
        fieldsCount: parsed.data.fieldsCount,
      },
      update: {
        foundationYear: parsed.data.foundationYear,
        teamsCount: parsed.data.teamsCount,
        membersCount: parsed.data.membersCount,
        fieldsCount: parsed.data.fieldsCount,
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Errore durante il salvataggio delle impostazioni." }, { status: 500 });
  }
}
