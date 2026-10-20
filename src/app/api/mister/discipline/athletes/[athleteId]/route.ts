import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { canManageAthleteCategory, getAthleteCategoryId } from "@/lib/athlete-access";
import { isCompetitionKind } from "@/lib/competition-kind";
import { seasonLabelFromDate } from "@/lib/discipline";
import { loadAthleteDisciplineSummary } from "@/lib/discipline-queries";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ athleteId: string }> };

/** GET ?seasonLabel=&competitionKind= — riepilogo disciplinare atleta (staff only). */
export async function GET(request: Request, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }
  if (
    session.user.role !== "COACH" &&
    session.user.role !== "ADMIN" &&
    session.user.role !== "YOUTH_DIRECTOR"
  ) {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { athleteId } = await context.params;
  const categoryId = await getAthleteCategoryId(athleteId);
  if (!categoryId) {
    return NextResponse.json({ error: "Atleta non trovato." }, { status: 404 });
  }
  const allowed = await canManageAthleteCategory({
    userId: session.user.id,
    role: session.user.role,
    categoryId,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const url = new URL(request.url);
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { seasonLabel: true, name: true },
  });
  const seasonLabel =
    url.searchParams.get("seasonLabel")?.trim() ||
    category?.seasonLabel ||
    seasonLabelFromDate();
  const competitionRaw = url.searchParams.get("competitionKind") ?? "LEAGUE";
  if (!isCompetitionKind(competitionRaw)) {
    return NextResponse.json({ error: "Competizione non valida." }, { status: 400 });
  }

  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { id: true, firstName: true, lastName: true, categoryId: true },
  });

  const summary = await loadAthleteDisciplineSummary({
    athleteId,
    seasonLabel,
    competitionKind: competitionRaw,
  });

  return NextResponse.json({
    success: true,
    data: {
      athlete,
      categoryName: category?.name ?? null,
      seasonLabel,
      competitionKind: competitionRaw,
      ...summary,
    },
  });
}
