import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { MonthCalendar, type CalendarEvent } from "@/components/calendar/month-calendar";
import { getAuthSession } from "@/lib/auth";
import { getCoachCategoryIdsForUser } from "@/lib/attendance";
import { COACH_VISIBLE_EVENT_TYPES } from "@/lib/events";
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
  const now = new Date();

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
            startAt: { gte: now },
          },
          orderBy: [{ startAt: "asc" }],
          take: 300,
          select: {
            id: true,
            title: true,
            type: true,
            startAt: true,
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
              { event: { is: { startAt: { gte: now } } } },
            ],
          },
          orderBy: {
            event: {
              startAt: "asc",
            },
          },
          take: 300,
          select: {
            id: true,
            notes: true,
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
          lte: now,
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
      take: 80,
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
    ...events.map((event) => ({
      id: `event-${event.id}`,
      title: event.title,
      date: event.startAt.toISOString(),
      type:
        event.type === "TRAINING"
          ? "ALLENAMENTO"
          : event.type === "FRIENDLY"
            ? "AMICHEVOLE"
            : "PARTITA",
      location: event.location,
      details: event.description,
      categoryId: event.categoryId,
      categoryName: event.category?.name ?? null,
    })),
    ...convocations
      .filter((convocation) => Boolean(convocation.event))
      .map((convocation) => ({
        id: `convocation-${convocation.id}`,
        title: `Convocazione - ${convocation.event!.title}`,
        date: convocation.event!.startAt.toISOString(),
        type: "CONVOCAZIONE" as const,
        location: convocation.event!.location,
        details: convocation.notes,
        categoryId: convocation.categoryId,
        categoryName: convocation.category.name,
      })),
    ...announcements
      .filter((announcement) => Boolean(announcement.publishedAt))
      .map((announcement) => ({
        id: `announcement-${announcement.id}`,
        title: announcement.title,
        date: announcement.publishedAt!.toISOString(),
        type: "RIUNIONE" as const,
        location: null,
        details: announcement.content,
        categoryId: announcement.categoryId,
        categoryName: announcement.category?.name ?? null,
      })),
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <AreaHeader
          title="Calendario mister"
          subtitle="Impegni mensili delle categorie assegnate"
          userName={session.user.name ?? "Mister"}
        />

        <div className="flex flex-wrap gap-2">
          <Link
            href="/mister"
            className="inline-flex items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Torna dashboard mister
          </Link>
        </div>

        <MonthCalendar
          title="Calendario mensile"
          subtitle="Visualizzi solo eventi, convocazioni e comunicazioni pertinenti alle tue categorie."
          events={calendarEvents}
          categoryOptions={categories}
          emptyMessage="Nessun evento disponibile per le categorie assegnate."
        />
      </div>
    </main>
  );
}
