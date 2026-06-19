import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildUniqueNewsSlug, requireSiteWebAdminApi } from "@/lib/site-cms-server";
import { upsertSiteNewsSchema } from "@/lib/validation/site";

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

  const parsed = upsertSiteNewsSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  try {
    const slug = await buildUniqueNewsSlug(parsed.data.title);
    const publishedAt = parsed.data.publishedAt
      ? new Date(parsed.data.publishedAt)
      : parsed.data.published
        ? new Date()
        : null;

    const created = await prisma.siteNews.create({
      data: {
        slug,
        title: parsed.data.title,
        subtitle: parsed.data.subtitle,
        content: parsed.data.content,
        coverImageUrl: parsed.data.coverImageUrl,
        category: parsed.data.category,
        published: parsed.data.published,
        publishedAt,
      },
      select: { id: true, slug: true },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore durante la creazione della news." }, { status: 500 });
  }
}
