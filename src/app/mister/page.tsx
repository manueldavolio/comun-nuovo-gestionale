import Link from "next/link";
import { redirect } from "next/navigation";
import { Camera, ClipboardList } from "lucide-react";
import { IncompleteMatchesPanel } from "@/components/mister/incomplete-matches-panel";
import { MisterHero } from "@/components/mister/mister-hero";
import { NextCommitmentCard } from "@/components/mister/next-commitment-card";
import { WeekTimeline } from "@/components/mister/week-timeline";
import { getAuthSession } from "@/lib/auth";
import { getCoachCategoryIdsForUser } from "@/lib/attendance";
import { nowAsEuropeRomeWallClockUtc } from "@/lib/date-input";
import { COACH_VISIBLE_EVENT_TYPES } from "@/lib/events";
import {
  isSameWallClockDay,
  selectTodaysMatchDayEvent,
  wallClockDayBounds,
} from "@/lib/match-day";
import {
  INCOMPLETE_MATCH_LOOKBACK_DAYS,
  selectIncompleteMatches,
} from "@/lib/mister-incomplete";
import { buildMisterWeekTimeline, wallClockWeekBounds } from "@/lib/mister-week";
import { computeFourPeriodBreakdown } from "@/lib/four-period-scoring";
import { isMatchEventType } from "@/lib/parent-season";
import { prisma } from "@/lib/prisma";

export default async function CoachDashboardPage() {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/mister");
  }

  if (session.user.role !== "COACH") {
    redirect("/unauthorized");
  }

  const coachCategoryIds = await getCoachCategoryIdsForUser(session.user.id);
  const wallNow = nowAsEuropeRomeWallClockUtc();
  const week = wallClockWeekBounds(wallNow);
  const todayBounds = wallClockDayBounds(wallNow);
  const lookbackStart = new Date(
    wallNow.getTime() - INCOMPLETE_MATCH_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  );

  const [categories, upcomingEvents, recentMatches, weekEvents] = await Promise.all([
    coachCategoryIds.length === 0
      ? Promise.resolve([])
      : prisma.category.findMany({
          where: { id: { in: coachCategoryIds } },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
    coachCategoryIds.length === 0
      ? Promise.resolve([])
      : prisma.event.findMany({
          where: {
            categoryId: { in: coachCategoryIds },
            type: { in: COACH_VISIBLE_EVENT_TYPES },
            startAt: { gte: todayBounds.start },
          },
          orderBy: [{ startAt: "asc" }],
          take: 60,
          select: {
            id: true,
            title: true,
            type: true,
            startAt: true,
            endAt: true,
            location: true,
            opponentName: true,
            isHome: true,
            category: { select: { name: true } },
            convocation: { select: { id: true, notes: true } },
          },
        }),
    coachCategoryIds.length === 0
      ? Promise.resolve([])
      : prisma.event.findMany({
          where: {
            categoryId: { in: coachCategoryIds },
            type: { in: ["LEAGUE_MATCH", "FRIENDLY", "TOURNAMENT"] },
            startAt: { gte: lookbackStart, lte: wallNow },
          },
          orderBy: [{ startAt: "desc" }],
          take: 40,
          select: {
            id: true,
            title: true,
            type: true,
            startAt: true,
            endAt: true,
            categoryId: true,
            category: { select: { name: true } },
            opponentName: true,
            homeScore: true,
            awayScore: true,
            isHome: true,
            attendances: { select: { id: true } },
            matchStats: { select: { goals: true } },
            periodScores: {
              select: { periodNumber: true, homeScore: true, awayScore: true },
            },
          },
        }),
    coachCategoryIds.length === 0
      ? Promise.resolve([])
      : prisma.event.findMany({
          where: {
            categoryId: { in: coachCategoryIds },
            type: { in: COACH_VISIBLE_EVENT_TYPES },
            startAt: { gte: week.start, lte: week.end },
          },
          orderBy: [{ startAt: "asc" }],
          take: 60,
          select: {
            id: true,
            title: true,
            type: true,
            startAt: true,
            opponentName: true,
            isHome: true,
          },
        }),
  ]);

  const todaysMatch = selectTodaysMatchDayEvent(upcomingEvents, wallNow);
  const todaysAny =
    todaysMatch ??
    upcomingEvents.find((event) => isSameWallClockDay(event.startAt, wallNow)) ??
    null;
  const nextUpcoming =
    upcomingEvents.find((event) => event.startAt.getTime() >= wallNow.getTime()) ?? null;
  const focusEvent = todaysAny ?? nextUpcoming;

  const nextCommitment = focusEvent
    ? {
        id: focusEvent.id,
        title: focusEvent.title,
        type: focusEvent.type,
        startAt: focusEvent.startAt,
        endAt: focusEvent.endAt,
        location: focusEvent.location,
        opponentName: focusEvent.opponentName,
        isHome: focusEvent.isHome,
        categoryName: focusEvent.category?.name ?? null,
        isToday: isSameWallClockDay(focusEvent.startAt, wallNow),
        hasConvocation: Boolean(focusEvent.convocation),
        convocationNotes: focusEvent.convocation?.notes ?? null,
      }
    : null;

  const incomplete = selectIncompleteMatches(
    recentMatches.map((event) => {
      const periodScores = event.periodScores.map((row) => ({
        periodNumber: row.periodNumber,
        homeScore: row.homeScore,
        awayScore: row.awayScore,
      }));
      const breakdown = computeFourPeriodBreakdown(periodScores, event.isHome);
      return {
        id: event.id,
        type: event.type,
        title: event.title,
        startAt: event.startAt,
        endAt: event.endAt,
        categoryId: event.categoryId,
        categoryName: event.category?.name ?? null,
        opponentName: event.opponentName,
        homeScore: event.homeScore,
        awayScore: event.awayScore,
        isHome: event.isHome,
        attendanceCount: event.attendances.length,
        playerGoalsSum: event.matchStats.reduce((sum, row) => sum + row.goals, 0),
        periodScores,
        realClubGoalsFromPeriods: breakdown.complete ? breakdown.realClubGoals : null,
      };
    }),
    { allowedCategoryIds: coachCategoryIds, wallNow },
  );

  const weekDays = buildMisterWeekTimeline(weekEvents, wallNow);

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5">
        <MisterHero
          userName={session.user.name ?? "Mister"}
          categoryNames={categories.map((category) => category.name)}
        />

        <NextCommitmentCard event={nextCommitment} wallNow={wallNow} />

        <IncompleteMatchesPanel matches={incomplete} />

        <WeekTimeline days={weekDays} />

        <section className="grid gap-3 sm:grid-cols-3">
          <Link
            href="/mister/squadra"
            className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm transition hover:border-blue-300"
          >
            <p className="text-sm font-bold text-blue-900">La mia squadra</p>
            <p className="mt-1 text-xs text-zinc-600">Rosa, ruoli, maglie e note mensili</p>
          </Link>
          <Link
            href="/mister/calendario"
            className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm transition hover:border-blue-300"
          >
            <p className="text-sm font-bold text-blue-900">Calendario</p>
            <p className="mt-1 text-xs text-zinc-600">Tutti gli impegni delle tue categorie</p>
          </Link>
          <Link
            href={
              focusEvent && isMatchEventType(focusEvent.type)
                ? `/mister/eventi/${focusEvent.id}/convocazioni`
                : nextUpcoming
                  ? `/mister/eventi/${nextUpcoming.id}/convocazioni`
                  : "/mister/calendario"
            }
            className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm transition hover:border-blue-300"
          >
            <p className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-900">
              <ClipboardList className="h-4 w-4" />
              Convocazioni
            </p>
            <p className="mt-1 text-xs text-zinc-600">Accesso rapido all&apos;impegno più vicino</p>
          </Link>
        </section>

        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href="/mister/riepilogo"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 font-semibold text-zinc-600 hover:bg-zinc-50"
          >
            Riepilogo analitico
          </Link>
          <Link
            href="/mister/media"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 font-semibold text-zinc-600 hover:bg-zinc-50"
          >
            <Camera className="h-3.5 w-3.5" />
            Media
          </Link>
        </div>
      </div>
    </main>
  );
}
