import "server-only";

import { getCoachCategoryIdsForUser } from "@/lib/attendance";
import { nowAsEuropeRomeWallClockUtc } from "@/lib/date-input";
import { isMissingDisciplineSchemaError } from "@/lib/discipline-db";
import {
  CONVOCATION_RESPONSE_SHORT_LABEL,
  MATCH_EVENT_TYPES,
  PARENT_VISIBLE_CARD_LABEL,
  filterConvocationsForAudience,
  filterRatingsForAudience,
  isParentVisibleCardType,
  resolveMatchLifecycleStatus,
  type MatchAudience,
  type MatchLifecycleStatus,
  type ParentVisibleCardType,
} from "@/lib/matches";
import { averagePresentScores } from "@/lib/match-player-rating";
import {
  athletesAssociatedToParentWhere,
  getParentProfileIdForUser,
} from "@/lib/parent-athletes";
import { currentSeasonRange, formatMatchResultLabel } from "@/lib/parent-season";
import { prisma } from "@/lib/prisma";

export type MatchListRow = {
  id: string;
  startAt: Date;
  title: string;
  opponentName: string | null;
  location: string | null;
  isHome: boolean | null;
  homeScore: number | null;
  awayScore: number | null;
  categoryId: string;
  categoryName: string;
  status: MatchLifecycleStatus;
};

export type MatchScorerDto = {
  athleteId: string;
  fullName: string;
  goals: number;
  assists: number;
};

export type MatchCardDto = {
  athleteId: string;
  fullName: string;
  type: ParentVisibleCardType;
  label: string;
  minute: number | null;
};

export type MatchRatingDto = {
  athleteId: string;
  fullName: string;
  /** Media criteri presenti. */
  matchAverage: number | null;
  /** Solo mister: note riservate. */
  notes: string | null;
  possessionScore: number | null;
  outOfPossessionScore: number | null;
  attitudeScore: number | null;
  teamworkScore: number | null;
};

export type MatchConvocationDto = {
  athleteId: string;
  fullName: string;
  responseStatus: "PENDING" | "PRESENT" | "ABSENT";
  responseLabel: string;
};

export type MatchDetailDto = {
  id: string;
  title: string;
  startAt: Date;
  location: string | null;
  opponentName: string | null;
  isHome: boolean | null;
  homeScore: number | null;
  awayScore: number | null;
  resultLabel: string | null;
  categoryId: string;
  categoryName: string;
  status: MatchLifecycleStatus;
  clubName: string;
  scorers: MatchScorerDto[];
  cards: MatchCardDto[];
  ratings: MatchRatingDto[];
  convocations: MatchConvocationDto[];
  /** Link modifica solo mister (mantenendo permessi esistenti via pagina eventi). */
  coachManageHref: string | null;
};

async function loadSeasonMatchEvents(categoryIds: string[], wallNow: Date) {
  if (categoryIds.length === 0) return [];
  const season = currentSeasonRange(wallNow);
  return prisma.event.findMany({
    where: {
      categoryId: { in: categoryIds },
      type: { in: [...MATCH_EVENT_TYPES] },
      startAt: { gte: season.start, lte: season.end },
    },
    orderBy: { startAt: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      startAt: true,
      location: true,
      opponentName: true,
      isHome: true,
      homeScore: true,
      awayScore: true,
      categoryId: true,
      category: { select: { name: true } },
    },
  });
}

function toListRow(
  event: Awaited<ReturnType<typeof loadSeasonMatchEvents>>[number],
  wallNow: Date,
): MatchListRow {
  return {
    id: event.id,
    startAt: event.startAt,
    title: event.title,
    opponentName: event.opponentName,
    location: event.location,
    isHome: event.isHome,
    homeScore: event.homeScore,
    awayScore: event.awayScore,
    categoryId: event.categoryId ?? "",
    categoryName: event.category?.name ?? "Categoria",
    status: resolveMatchLifecycleStatus({
      startAt: event.startAt,
      homeScore: event.homeScore,
      awayScore: event.awayScore,
      title: event.title,
      description: event.description,
      wallNow,
    }),
  };
}

export async function listMatchesForCoach(userId: string): Promise<MatchListRow[]> {
  const categoryIds = await getCoachCategoryIdsForUser(userId);
  const wallNow = nowAsEuropeRomeWallClockUtc();
  const events = await loadSeasonMatchEvents(categoryIds, wallNow);
  return events.map((event) => toListRow(event, wallNow));
}

export async function resolveParentMatchCategoryContext(userId: string): Promise<{
  parentProfileId: string | null;
  athleteIds: string[];
  categoryIds: string[];
  athleteIdSet: Set<string>;
}> {
  const parentProfileId = await getParentProfileIdForUser(userId);
  if (!parentProfileId) {
    return {
      parentProfileId: null,
      athleteIds: [],
      categoryIds: [],
      athleteIdSet: new Set(),
    };
  }

  const athletes = await prisma.athlete.findMany({
    where: athletesAssociatedToParentWhere(parentProfileId),
    select: { id: true, categoryId: true },
  });
  const athleteIds = athletes.map((a) => a.id);
  const categoryIds = [...new Set(athletes.map((a) => a.categoryId))];
  return {
    parentProfileId,
    athleteIds,
    categoryIds,
    athleteIdSet: new Set(athleteIds),
  };
}

export async function listMatchesForParent(userId: string): Promise<MatchListRow[]> {
  const ctx = await resolveParentMatchCategoryContext(userId);
  const wallNow = nowAsEuropeRomeWallClockUtc();
  const events = await loadSeasonMatchEvents(ctx.categoryIds, wallNow);
  return events.map((event) => toListRow(event, wallNow));
}

async function loadMatchEventById(eventId: string) {
  return prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      startAt: true,
      location: true,
      opponentName: true,
      isHome: true,
      homeScore: true,
      awayScore: true,
      categoryId: true,
      category: { select: { id: true, name: true } },
      matchStats: {
        where: {
          OR: [{ goals: { gt: 0 } }, { assists: { gt: 0 } }],
        },
        select: {
          athleteId: true,
          goals: true,
          assists: true,
          athlete: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ goals: "desc" }, { assists: "desc" }],
      },
      convocation: {
        select: {
          athletes: {
            select: {
              athleteId: true,
              responseStatus: true,
              athlete: { select: { firstName: true, lastName: true } },
            },
            orderBy: [
              { athlete: { lastName: "asc" } },
              { athlete: { firstName: "asc" } },
            ],
          },
        },
      },
    },
  });
}

async function loadMatchCards(eventId: string): Promise<MatchCardDto[]> {
  try {
    const incidents = await prisma.disciplinaryIncident.findMany({
      where: {
        eventId,
        status: "ACTIVE",
        type: { in: ["YELLOW_CARD", "RED_CARD", "SECOND_YELLOW_RED"] },
      },
      select: {
        athleteId: true,
        type: true,
        minute: true,
        athlete: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ minute: "asc" }, { createdAt: "asc" }],
    });
    return incidents
      .filter((row) => isParentVisibleCardType(row.type))
      .map((row) => ({
        athleteId: row.athleteId,
        fullName: `${row.athlete.firstName} ${row.athlete.lastName}`.trim(),
        type: row.type as ParentVisibleCardType,
        label: PARENT_VISIBLE_CARD_LABEL[row.type as ParentVisibleCardType],
        minute: row.minute,
      }));
  } catch (error) {
    if (isMissingDisciplineSchemaError(error)) return [];
    throw error;
  }
}

async function loadMatchRatingsRaw(eventId: string) {
  try {
    return await prisma.matchPlayerRating.findMany({
      where: { eventId },
      select: {
        athleteId: true,
        possessionScore: true,
        outOfPossessionScore: true,
        attitudeScore: true,
        teamworkScore: true,
        notes: true,
        athlete: { select: { firstName: true, lastName: true } },
      },
      orderBy: [
        { athlete: { lastName: "asc" } },
        { athlete: { firstName: "asc" } },
      ],
    });
  } catch (error) {
    if (isMissingDisciplineSchemaError(error)) return [];
    throw error;
  }
}

function athleteFullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

export async function getMatchDetailForAudience(options: {
  eventId: string;
  audience: MatchAudience;
  /** Categorie autorizzate (mister assegnate / genitore figli). */
  allowedCategoryIds: ReadonlySet<string>;
  /** Figli del genitore; null per mister. */
  allowedAthleteIds: ReadonlySet<string> | null;
}): Promise<MatchDetailDto | null> {
  const event = await loadMatchEventById(options.eventId);
  if (!event) return null;
  if (!(MATCH_EVENT_TYPES as readonly string[]).includes(event.type)) {
    return null;
  }
  if (!event.categoryId || !options.allowedCategoryIds.has(event.categoryId)) {
    return null;
  }

  const wallNow = nowAsEuropeRomeWallClockUtc();
  const clubName = "Comun Nuovo";
  const status = resolveMatchLifecycleStatus({
    startAt: event.startAt,
    homeScore: event.homeScore,
    awayScore: event.awayScore,
    title: event.title,
    description: event.description,
    wallNow,
  });

  const scorers: MatchScorerDto[] = event.matchStats.map((row) => ({
    athleteId: row.athleteId,
    fullName: athleteFullName(row.athlete.firstName, row.athlete.lastName),
    goals: row.goals,
    assists: row.assists,
  }));

  const cards = await loadMatchCards(event.id);
  const ratingsRaw = await loadMatchRatingsRaw(event.id);
  const ratingsFiltered = filterRatingsForAudience(
    ratingsRaw,
    options.audience,
    options.allowedAthleteIds,
  );

  const ratings: MatchRatingDto[] = ratingsFiltered
    .map((row) => {
      const scores = {
        possessionScore: row.possessionScore,
        outOfPossessionScore: row.outOfPossessionScore,
        attitudeScore: row.attitudeScore,
        teamworkScore: row.teamworkScore,
      };
      const matchAverage = averagePresentScores(scores);
      if (options.audience === "parent") {
        // DTO sanitizzato: media sì, criteri grezzi e note no (anti-leak).
        return {
          athleteId: row.athleteId,
          fullName: athleteFullName(row.athlete.firstName, row.athlete.lastName),
          matchAverage,
          notes: null,
          possessionScore: null,
          outOfPossessionScore: null,
          attitudeScore: null,
          teamworkScore: null,
        };
      }
      return {
        athleteId: row.athleteId,
        fullName: athleteFullName(row.athlete.firstName, row.athlete.lastName),
        matchAverage,
        notes: row.notes,
        ...scores,
      };
    })
    .filter((row) => options.audience === "coach" || row.matchAverage != null);

  const convocationRows = (event.convocation?.athletes ?? []).map((row) => ({
    athleteId: row.athleteId,
    fullName: athleteFullName(row.athlete.firstName, row.athlete.lastName),
    responseStatus: row.responseStatus as "PENDING" | "PRESENT" | "ABSENT",
    responseLabel: CONVOCATION_RESPONSE_SHORT_LABEL[row.responseStatus],
  }));
  const convocations = filterConvocationsForAudience(
    convocationRows,
    options.audience,
    options.allowedAthleteIds,
  );

  return {
    id: event.id,
    title: event.title,
    startAt: event.startAt,
    location: event.location,
    opponentName: event.opponentName,
    isHome: event.isHome,
    homeScore: event.homeScore,
    awayScore: event.awayScore,
    resultLabel: formatMatchResultLabel({
      clubName,
      opponentName: event.opponentName,
      homeScore: event.homeScore,
      awayScore: event.awayScore,
      isHome: event.isHome,
      fallbackTitle: event.title,
    }),
    categoryId: event.categoryId,
    categoryName: event.category?.name ?? "Categoria",
    status,
    clubName,
    scorers,
    cards,
    ratings,
    convocations,
    coachManageHref:
      options.audience === "coach" ? `/mister/eventi/${event.id}/presenze` : null,
  };
}

export async function getCoachMatchDetail(
  userId: string,
  eventId: string,
): Promise<MatchDetailDto | null> {
  const categoryIds = await getCoachCategoryIdsForUser(userId);
  return getMatchDetailForAudience({
    eventId,
    audience: "coach",
    allowedCategoryIds: new Set(categoryIds),
    allowedAthleteIds: null,
  });
}

export async function getParentMatchDetail(
  userId: string,
  eventId: string,
): Promise<MatchDetailDto | null> {
  const ctx = await resolveParentMatchCategoryContext(userId);
  return getMatchDetailForAudience({
    eventId,
    audience: "parent",
    allowedCategoryIds: new Set(ctx.categoryIds),
    allowedAthleteIds: ctx.athleteIdSet,
  });
}
