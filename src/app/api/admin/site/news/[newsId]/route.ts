import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildUniqueNewsSlug, requireSiteWebAdminApi } from "@/lib/site-cms-server";
import { upsertSiteNewsSchema } from "@/lib/validation/site";

export async function PUT(
  request: Request,
  context: { params: Promise<{ newsId: string }> },
) {
  const { errorResponse } = await requireSiteWebAdminApi();
  if (errorResponse) {
    return errorResponse;
  }

  const { newsId } = await context.params;

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

  const news = await prisma.siteNews.findUnique({
    where: { id: newsId },
    select: { id: true, title: true, slug: true, publishedAt: true },
  });
  if (!news) {
    return NextResponse.json({ error: "News non trovata." }, { status: 404 });
  }

  try {
    // Rigenera lo slug solo se il titolo cambia, per non rompere i link esistenti.
    const slug =
      news.title === parsed.data.title
        ? news.slug
        : await buildUniqueNewsSlug(parsed.data.title, news.id);

    const publishedAt = parsed.data.publishedAt
      ? new Date(parsed.data.publishedAt)
      : parsed.data.published
        ? (news.publishedAt ?? new Date())
        : news.publishedAt;

    await prisma.siteNews.update({
      where: { id: newsId },
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
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Errore durante l'aggiornamento della news." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ newsId: string }> },
) {
  const { errorResponse } = await requireSiteWebAdminApi();
  if (errorResponse) {
    return errorResponse;
  }

  const { newsId } = await context.params;

  const news = await prisma.siteNews.findUnique({
    where: { id: newsId },
    select: { id: true },
  });
  if (!news) {
    return NextResponse.json({ error: "News non trovata." }, { status: 404 });
  }

  try {
    await prisma.siteNews.delete({ where: { id: newsId } });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Errore durante l'eliminazione della news." }, { status: 500 });
  }
}
