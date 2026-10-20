import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { isMissingDisciplineSchemaError } from "@/lib/discipline-db";
import { currentSeasonRange, MATCH_EVENT_TYPES } from "@/lib/parent-season";
import {
  buildParentSeasonRatingSummary,
  decideParentAthleteRatingsAccess,
} from "@/lib/parent-match-ratings";
import {
  getParentProfileIdForUser,
  isParentAssociatedToAthlete,
} from "@/lib/parent-athletes";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ athleteId: string }>;
};

/**
 * Valutazioni stagione del solo atleta associato al genitore autenticato.
 * Non espone note mister né voti di altri atleti.
 */
export async function GET(_request: Request, context: RouteContext) {
  const session = await getAuthSession();
  const { athleteId } = await context.params;

  if (!athleteId?.trim()) {
    return NextResponse.json({ error: "Atleta non valido." }, { status: 400 });
  }

  const parentProfileId = session?.user?.id
    ? await getParentProfileIdForUser(session.user.id)
    : null;
  const associated =
    parentProfileId != null
      ? await isParentAssociatedToAthlete({
          parentProfileId,
          athleteId,
        })
      : false;

  const access = decideParentAthleteRatingsAccess({
    authenticated: Boolean(session?.user?.id),
    role: session?.user?.role,
    parentAssociatedToAthlete: associated,
  });
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Sessione non valida." : "Operazione non consentita." },
      { status: access.status },
    );
  }

  const season = currentSeasonRange();

  try {
    const rows = await prisma.matchPlayerRating.findMany({
      where: {
        athleteId,
        event: {
          startAt: { gte: season.start, lte: season.end },
          type: { in: [...MATCH_EVENT_TYPES] },
        },
      },
      select: {
        possessionScore: true,
        outOfPossessionScore: true,
        attitudeScore: true,
        teamworkScore: true,
        event: {
          select: {
            id: true,
            startAt: true,
            opponentName: true,
            title: true,
          },
        },
      },
      orderBy: { event: { startAt: "desc" } },
    });

    const summary = buildParentSeasonRatingSummary(
      rows.map((row) => ({
        eventId: row.event.id,
        startAt: row.event.startAt,
        opponentName: row.event.opponentName,
        title: row.event.title,
        possessionScore: row.possessionScore,
        outOfPossessionScore: row.outOfPossessionScore,
        attitudeScore: row.attitudeScore,
        teamworkScore: row.teamworkScore,
      })),
    );

    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    if (isMissingDisciplineSchemaError(error)) {
      return NextResponse.json({
        success: true,
        data: { mediaVoti: null, ratedMatchCount: 0, matches: [] },
      });
    }
    console.error("[genitore ratings]", error);
    return NextResponse.json({ error: "Impossibile caricare le valutazioni." }, { status: 500 });
  }
}
