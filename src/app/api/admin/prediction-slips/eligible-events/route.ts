import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  PREDICTION_MATCH_EVENT_TYPES,
  isEventEligibleForPredictionSlip,
  buildMatchSideLabels,
} from "@/lib/prediction-slip";
import { resolveMatchDayOpponentName } from "@/lib/match-day";

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const whereStartAt: { gte?: Date; lte?: Date } = {};
  if (from) {
    const parsed = new Date(from);
    if (!Number.isNaN(parsed.getTime())) whereStartAt.gte = parsed;
  }
  if (to) {
    const parsed = new Date(to);
    if (!Number.isNaN(parsed.getTime())) whereStartAt.lte = parsed;
  }

  const events = await prisma.event.findMany({
    where: {
      type: { in: [...PREDICTION_MATCH_EVENT_TYPES] },
      ...(Object.keys(whereStartAt).length > 0 ? { startAt: whereStartAt } : {}),
    },
    orderBy: [{ startAt: "asc" }],
    take: 200,
    select: {
      id: true,
      title: true,
      type: true,
      startAt: true,
      isHome: true,
      opponentName: true,
      category: { select: { name: true } },
    },
  });

  const data = events
    .map((event) => {
      const eligible = isEventEligibleForPredictionSlip(event);
      if (!eligible.ok) return null;
      const opponent = resolveMatchDayOpponentName({
        opponentName: event.opponentName,
        title: event.title,
      });
      const sides = buildMatchSideLabels({
        isHome: event.isHome === true,
        opponentName: opponent,
      });
      return {
        id: event.id,
        title: event.title,
        type: event.type,
        startAt: event.startAt,
        categoryName: event.category?.name ?? null,
        isHome: event.isHome,
        opponentName: opponent,
        homeLabel: sides.homeLabel,
        awayLabel: sides.awayLabel,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ success: true, data });
}
