import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { MonthlyCalendar, type CalendarEventItem } from "@/components/calendar/monthly-calendar";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { COACH_VISIBLE_EVENT_TYPES, formatEventType } from "@/lib/events";

export default async function ParentCalendarPage() {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/genitore/calendario");
  }

  if (session.user.role !== "PARENT") {
    redirect("/unauthorized");
  }

  const parentProfile = await prisma.parentProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      athletes: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          categoryId: true,
          category: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!parentProfile) {
    redirect("/unauthorized");
  }

  const categoryMap = new Map<string, string>();
  for (const athlete of parentProfile.athletes) {
    categoryMap.set(athlete.categoryId, athlete.category.name);
  }
  const categoryIds = [...categoryMap.keys()];
  const athleteIds = parentProfile.athletes.map((athlete) => athlete.id);
  const athleteNameById = new Map(
    parentProfile.athletes.map((athlete) => [
      athlete.id,
      `${athlete.firstName} ${athlete.lastName}`.trim(),
    ]),
  );

  const now = new Date();
  const [events, convocationEntries, announcements] = await Promise.all([
    categoryIds.length === 0
      ? Promise.resolve([])
      : prisma.event.findMany({
          where: {
            categoryId: { in: categoryIds },
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
    athleteIds.length === 0
      ? Promise.resolve([])
      : prisma.convocationAthlete.findMany({
          where: {
            athleteId: { in: athleteIds },
            convocation: {
              event: {
                isNot: null,
                startAt: { gte: now },
              },
            },
          },
          orderBy: {
            convocation: {
              event: {
                startAt: "asc",
              },
            },
          },
          take: 300,
          select: {
            id: true,
            athleteId: true,
            convocation: {
              select: {
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
          { audience: "PARENTS" },
          {
            audience: "CATEGORY_ONLY",
            categoryId: {
              in: categoryIds,
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

  const calendarEvents: CalendarEventItem[] = [
    ...events.map((event) => ({
      id: `event-${event.id}`,
      title: event.title,
      startsAtIso: event.startAt.toISOString(),
      kind:
        event.type === "TRAINING"
          ? "TRAINING"
          : event.type === "LEAGUE_MATCH"
            ? "LEAGUE_MATCH"
            : event.type === "FRIENDLY"
              ? "FRIENDLY"
              : "OTHER",
      typeLabel: formatEventType(event.type),
      location: event.location,
      details: event.description,
      categoryId: event.categoryId,
      categoryName: event.category?.name ?? null,
    })),
    ...convocationEntries
      .filter((entry) => Boolean(entry.convocation.event))
      .map((entry) => ({
        id: `convocation-${entry.id}`,
        title: `Convocazione - ${entry.convocation.event!.title}`,
        startsAtIso: entry.convocation.event!.startAt.toISOString(),
        kind: "CONVOCATION" as const,
        typeLabel: "Convocazione",
        location: entry.convocation.event!.location,
        details: entry.convocation.notes,
        categoryId: entry.convocation.categoryId,
        categoryName: entry.convocation.category.name,
        athleteName: athleteNameById.get(entry.athleteId) ?? null,
      })),
    ...announcements
      .filter((announcement) => Boolean(announcement.publishedAt))
      .map((announcement) => ({
        id: `announcement-${announcement.id}`,
        title: announcement.title,
        startsAtIso: announcement.publishedAt!.toISOString(),
        kind: "OTHER" as const,
        typeLabel: "Comunicazione",
        location: null,
        details: announcement.content,
        categoryId: announcement.categoryId,
        categoryName: announcement.category?.name ?? null,
      })),
  ];

  const categoryOptions = categoryIds.map((categoryId) => ({
    id: categoryId,
    name: categoryMap.get(categoryId) ?? categoryId,
  }));

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <AreaHeader
          title="Calendario genitore"
          subtitle="Eventi, convocazioni e comunicazioni dei tuoi figli"
          userName={session.user.name ?? "Genitore"}
        />

        <div className="flex flex-wrap gap-2">
          <Link
            href="/genitore"
            className="inline-flex items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Torna dashboard genitore
          </Link>
        </div>

        <MonthlyCalendar
          title="Calendario mensile"
          subtitle="Tap sul giorno per vedere gli impegni, tap sull'evento per i dettagli."
          events={calendarEvents}
          categoryOptions={categoryOptions}
          emptyMessage="Nessun evento disponibile per i tuoi figli."
        />
      </div>
    </main>
  );
}
