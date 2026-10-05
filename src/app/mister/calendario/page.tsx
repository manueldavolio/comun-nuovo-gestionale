import { redirect } from "next/navigation";
import { MonthCalendar, type CalendarEvent } from "@/components/calendar/month-calendar";
import { getAuthSession } from "@/lib/auth";
import { getCoachCategoryIdsForUser } from "@/lib/attendance";
import { normalizeCalendarEventType } from "@/lib/calendar-event-type";
import {
  currentCalendarMonthStart,
  formatYearMonth,
} from "@/lib/calendar-range";
import { nowAsEuropeRomeWallClockUtc, toFloatingDateTime } from "@/lib/date-input";
import { COACH_VISIBLE_EVENT_TYPES } from "@/lib/events";
import { currentSeasonRange, isMatchEventType } from "@/lib/parent-season";
import { prisma } from "@/lib/prisma";

export default async function CoachCalendarPage() {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/mister/calendario");
  }

  if (session.user.role !== "COACH") {
    redirect("/unauthorized");
  }

  const coachCategoryIds = await getCoachCategoryIdsForUser(session.user.id);
  const wallNow = nowAsEuropeRomeWallClockUtc();
  const season = currentSeasonRange(wallNow);
  const currentMonth = currentCalendarMonthStart();
  // Stagione corrente completa (niente take:500): il mister ha poche categorie.
  const rangeStart = season.start;
  const rangeEnd = season.end;

  const [categories, events, convocations, announcements] = await Promise.all([
    coachCategoryIds.length === 0
      ? Promise.resolve([])
      : prisma.category.findMany({
          where: {
            id: { in: coachCategoryIds },
          },
          orderBy: [{ name: "asc" }],
          select: {
            id: true,
            name: true,
          },
        }),
    coachCategoryIds.length === 0
      ? Promise.resolve([])
      : prisma.event.findMany({
          where: {
            categoryId: { in: coachCategoryIds },
            type: { in: COACH_VISIBLE_EVENT_TYPES },
            startAt: { gte: rangeStart, lte: rangeEnd },
          },
          orderBy: [{ startAt: "asc" }],
          select: {
            id: true,
            title: true,
            type: true,
            startAt: true,
            endAt: true,
            location: true,
            description: true,
            categoryId: true,
            category: {
              select: {
                name: true,
              },
            },
          },
        }),
    coachCategoryIds.length === 0
      ? Promise.resolve([])
      : prisma.convocation.findMany({
          where: {
            categoryId: { in: coachCategoryIds },
            AND: [
              { event: { isNot: null } },
              {
                event: {
                  is: { startAt: { gte: rangeStart, lte: rangeEnd } },
                },
              },
            ],
          },
          orderBy: {
            event: {
              startAt: "asc",
            },
          },
          select: {
            id: true,
            notes: true,
            meetingAt: true,
            categoryId: true,
            category: {
              select: {
                name: true,
              },
            },
            event: {
              select: {
                id: true,
                title: true,
                startAt: true,
                location: true,
              },
            },
          },
        }),
    prisma.announcement.findMany({
      where: {
        publishedAt: {
          not: null,
          lte: new Date(),
          gte: rangeStart,
        },
        OR: [
          { audience: "ALL" },
          { audience: "COACHES" },
          {
            audience: "CATEGORY_ONLY",
            categoryId: {
              in: coachCategoryIds,
            },
          },
        ],
      },
      orderBy: [{ publishedAt: "desc" }],
      select: {
        id: true,
        title: true,
        content: true,
        publishedAt: true,
        categoryId: true,
        category: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  const calendarEvents: CalendarEvent[] = [
    ...events.map((event) => {
      const canManage = Boolean(
        event.categoryId && coachCategoryIds.includes(event.categoryId),
      );
      const match = isMatchEventType(event.type);

      return {
        id: `event-${event.id}`,
        title: event.title,
        date: toFloatingDateTime(event.startAt),
        endDate: event.endAt ? toFloatingDateTime(event.endAt) : null,
        type: normalizeCalendarEventType(event.type),
        location: event.location,
        details: event.description,
        categoryId: event.categoryId,
        categoryName: event.category?.name ?? null,
        manageHref: canManage ? `/mister/eventi/${event.id}/presenze` : null,
        manageLabel: canManage
          ? match
            ? "Gestisci partita"
            : "Registra presenze"
          : null,
        editHref: canManage ? `/mister/eventi/${event.id}/modifica` : null,
        deleteEndpoint: canManage ? `/api/events/${event.id}` : null,
        convocationHref: canManage ? `/mister/eventi/${event.id}/convocazioni` : null,
      };
    }),
    ...convocations
      .filter((convocation) => Boolean(convocation.event))
      .map((convocation) => ({
        id: `convocation-${convocation.id}`,
        title: `Convocazione - ${convocation.event!.title}`,
        date: toFloatingDateTime(convocation.meetingAt ?? convocation.event!.startAt),
        type: normalizeCalendarEventType("CONVOCAZIONE"),
        location: convocation.event!.location,
        details: convocation.notes,
        categoryId: convocation.categoryId,
        categoryName: convocation.category.name,
        manageHref: `/mister/eventi/${convocation.event!.id}/convocazioni`,
        manageLabel: "Gestisci convocazione",
      })),
    ...announcements
      .filter((announcement) => Boolean(announcement.publishedAt))
      .map((announcement) => ({
        id: `announcement-${announcement.id}`,
        title: announcement.title,
        date: toFloatingDateTime(announcement.publishedAt!),
        type: normalizeCalendarEventType("RIUNIONE"),
        location: null,
        details: announcement.content,
        categoryId: announcement.categoryId,
        categoryName: announcement.category?.name ?? null,
      })),
  ];

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
        <header className="rounded-2xl border border-blue-700 bg-blue-800 p-5 text-white shadow-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200">
            Area Mister
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">Calendario</h1>
          <p className="mt-1 text-sm text-sky-100">
            Impegni delle categorie assegnate · {session.user.name ?? "Mister"}
          </p>
        </header>

        <MonthCalendar
          title="Calendario mensile"
          subtitle="Eventi, convocazioni e comunicazioni delle tue categorie. Usa Gestisci partita / Registra presenze per il Match Center."
          events={calendarEvents}
          categoryOptions={categories}
          showTypeFilter
          initialYearMonth={formatYearMonth(currentMonth)}
          emptyMessage="Nessun evento disponibile per le categorie assegnate."
        />
      </div>
    </main>
  );
}
