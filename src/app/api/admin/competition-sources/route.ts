import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSiteWebAdminApi } from "@/lib/site-cms-server";
import {
  ESORDIENTI_TUTTOCAMPO_WIDGET_UUID,
  buildTuttocampoWidgetUrls,
  isAllowedTuttocampoWidgetUrl,
  isEsordientiCategory,
  isValidTuttocampoWidgetUuid,
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

  const data = parsed.data;
  const uuid = data.tuttocampoWidgetUuid;

  const category = await prisma.category.findUnique({
    where: { id: data.categoryId },
    select: { id: true, name: true, seasonLabel: true },
  });
  if (!category) {
    return NextResponse.json({ error: "Categoria non trovata." }, { status: 404 });
  }

  if (uuid && isValidTuttocampoWidgetUuid(uuid)) {
    const isEsordientiUuid =
      uuid.toLowerCase() === ESORDIENTI_TUTTOCAMPO_WIDGET_UUID.toLowerCase();
    if (isEsordientiUuid && !isEsordientiCategory(category.name) && !data.allowSharedUuid) {
      return NextResponse.json(
        {
          error:
            "L’UUID 99f6f12c-… appartiene agli Esordienti. Seleziona la categoria Esordienti, oppure abilita esplicitamente la condivisione UUID.",
        },
        { status: 400 },
      );
    }

    const duplicate = await prisma.categoryCompetitionSource.findFirst({
      where: {
        tuttocampoWidgetUuid: uuid,
        NOT: { categoryId: data.categoryId },
      },
      select: {
        id: true,
        category: { select: { name: true, seasonLabel: true } },
      },
    });
    if (duplicate && !data.allowSharedUuid) {
      return NextResponse.json(
        {
          error: `Questo UUID è già collegato a «${duplicate.category.name}» (${duplicate.category.seasonLabel}). Ogni categoria dovrebbe avere un UUID proprio, salvo scelta esplicita di condivisione.`,
        },
        { status: 400 },
      );
    }
  }

  let widgetStandingsUrl = data.widgetStandingsUrl;
  let widgetResultsUrl = data.widgetResultsUrl;
  let widgetScorersUrl = data.widgetScorersUrl;
  let widgetLastMatchUrl = data.widgetLastMatchUrl;
  let widgetNextMatchUrl = data.widgetNextMatchUrl;

  if (uuid && isValidTuttocampoWidgetUuid(uuid)) {
    const built = buildTuttocampoWidgetUrls(uuid, data.widgetSeasonParam);
    widgetResultsUrl = built.results;
    widgetStandingsUrl = built.standings;
    widgetScorersUrl = built.scorers;
    widgetLastMatchUrl = built.lastMatch;
    widgetNextMatchUrl = built.nextMatch;
  }

  for (const url of [
    widgetStandingsUrl,
    widgetResultsUrl,
    widgetScorersUrl,
    widgetLastMatchUrl,
    widgetNextMatchUrl,
  ]) {
    if (!isAllowedTuttocampoWidgetUrl(url)) {
      return NextResponse.json(
        {
          error:
            "URL widget non valido. Solo https://www.tuttocampo.it/WidgetV2/{Risultati|Classifica|Marcatori|Partita|ProssimaPartita}/{uuid}[+?y=].",
        },
        { status: 400 },
      );
    }
  }

  if (data.manualStandingsJson && parseManualStandingsJson(data.manualStandingsJson) === null) {
    return NextResponse.json(
      { error: "JSON classifica manuale non valido (atteso array di {pos,team,points})." },
      { status: 400 },
    );
  }

  const saved = await prisma.categoryCompetitionSource.upsert({
    where: { categoryId: data.categoryId },
    create: {
      categoryId: data.categoryId,
      seasonLabel: data.seasonLabel,
      competitionName: data.competitionName,
      groupLabel: data.groupLabel,
      sourceType: data.sourceType,
      sourcePageUrl: data.sourcePageUrl,
      tuttocampoWidgetUuid: uuid,
      widgetSeasonParam: data.widgetSeasonParam,
      widgetStandingsUrl,
      widgetResultsUrl,
      widgetScorersUrl,
      widgetLastMatchUrl,
      widgetNextMatchUrl,
      manualStandingsJson: data.manualStandingsJson,
      sourceNotes: data.sourceNotes,
      lastVerifiedAt: data.lastVerifiedAt ? new Date(data.lastVerifiedAt) : null,
      lastManualUpdateAt: data.manualStandingsJson ? new Date() : null,
      isActive: data.isActive,
    },
    update: {
      seasonLabel: data.seasonLabel,
      competitionName: data.competitionName,
      groupLabel: data.groupLabel,
      sourceType: data.sourceType,
      sourcePageUrl: data.sourcePageUrl,
      tuttocampoWidgetUuid: uuid,
      widgetSeasonParam: data.widgetSeasonParam,
      widgetStandingsUrl,
      widgetResultsUrl,
      widgetScorersUrl,
      widgetLastMatchUrl,
      widgetNextMatchUrl,
      manualStandingsJson: data.manualStandingsJson,
      sourceNotes: data.sourceNotes,
      lastVerifiedAt: data.lastVerifiedAt ? new Date(data.lastVerifiedAt) : null,
      lastManualUpdateAt: data.manualStandingsJson ? new Date() : undefined,
      isActive: data.isActive,
    },
    select: { id: true },
  });

  return NextResponse.json({ success: true, data: saved });
}
