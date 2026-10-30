import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSiteWebAdminApi } from "@/lib/site-cms-server";
import {
  isAllowedTuttocampoWidgetUrl,
  parseManualStandingsJson,
} from "@/lib/team-competition";
import { upsertCompetitionSourceSchema } from "@/lib/validation/family-benefits";

export async function GET() {
  const { errorResponse } = await requireSiteWebAdminApi();
  if (errorResponse) return errorResponse;

  const rows = await prisma.categoryCompetitionSource.findMany({
    include: {
      category: { select: { id: true, name: true, seasonLabel: true, sector: true } },
    },
    orderBy: [{ seasonLabel: "desc" }, { competitionName: "asc" }],
  });
  return NextResponse.json({ data: rows });
}

export async function PUT(request: Request) {
  const { errorResponse } = await requireSiteWebAdminApi();
  if (errorResponse) return errorResponse;

  const payload = await request.json().catch(() => null);
  const parsed = upsertCompetitionSourceSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  for (const url of [
    parsed.data.widgetStandingsUrl,
    parsed.data.widgetResultsUrl,
    parsed.data.widgetNextMatchUrl,
  ]) {
    if (!isAllowedTuttocampoWidgetUrl(url)) {
      return NextResponse.json(
        {
          error:
            "URL widget non valido. Usa solo iframe ufficiali https://www.tuttocampo.it/WidgetV2/… generati da Tuttocampo.",
        },
        { status: 400 },
      );
    }
  }

  if (
    parsed.data.manualStandingsJson &&
    parseManualStandingsJson(parsed.data.manualStandingsJson) === null
  ) {
    return NextResponse.json(
      { error: "JSON classifica manuale non valido (atteso array di {pos,team,points})." },
      { status: 400 },
    );
  }

  const category = await prisma.category.findUnique({
    where: { id: parsed.data.categoryId },
    select: { id: true },
  });
  if (!category) {
    return NextResponse.json({ error: "Categoria non trovata." }, { status: 404 });
  }

  const saved = await prisma.categoryCompetitionSource.upsert({
    where: { categoryId: parsed.data.categoryId },
    create: {
      categoryId: parsed.data.categoryId,
      seasonLabel: parsed.data.seasonLabel,
      competitionName: parsed.data.competitionName,
      groupLabel: parsed.data.groupLabel,
      sourceType: parsed.data.sourceType,
      sourcePageUrl: parsed.data.sourcePageUrl,
      widgetStandingsUrl: parsed.data.widgetStandingsUrl,
      widgetResultsUrl: parsed.data.widgetResultsUrl,
      widgetNextMatchUrl: parsed.data.widgetNextMatchUrl,
      manualStandingsJson: parsed.data.manualStandingsJson,
      sourceNotes: parsed.data.sourceNotes,
      lastVerifiedAt: parsed.data.lastVerifiedAt ? new Date(parsed.data.lastVerifiedAt) : null,
      lastManualUpdateAt: parsed.data.manualStandingsJson ? new Date() : null,
      isActive: parsed.data.isActive,
    },
    update: {
      seasonLabel: parsed.data.seasonLabel,
      competitionName: parsed.data.competitionName,
      groupLabel: parsed.data.groupLabel,
      sourceType: parsed.data.sourceType,
      sourcePageUrl: parsed.data.sourcePageUrl,
      widgetStandingsUrl: parsed.data.widgetStandingsUrl,
      widgetResultsUrl: parsed.data.widgetResultsUrl,
      widgetNextMatchUrl: parsed.data.widgetNextMatchUrl,
      manualStandingsJson: parsed.data.manualStandingsJson,
      sourceNotes: parsed.data.sourceNotes,
      lastVerifiedAt: parsed.data.lastVerifiedAt ? new Date(parsed.data.lastVerifiedAt) : null,
      lastManualUpdateAt: parsed.data.manualStandingsJson ? new Date() : undefined,
      isActive: parsed.data.isActive,
    },
    select: { id: true },
  });

  return NextResponse.json({ success: true, data: saved });
}
