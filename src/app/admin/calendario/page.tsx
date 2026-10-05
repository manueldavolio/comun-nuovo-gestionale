import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { MonthCalendar, type CalendarEvent } from "@/components/calendar/month-calendar";
import { getAuthSession } from "@/lib/auth";
import { getCoachCategoryIdsForUser } from "@/lib/attendance";
import { normalizeCalendarEventType } from "@/lib/calendar-event-type";
import {
  calendarVisibleRangeForMonth,
  currentCalendarMonthStart,
  formatYearMonth,
} from "@/lib/calendar-range";
import { toFloatingDateTime } from "@/lib/date-input";
import { COACH_VISIBLE_EVENT_TYPES } from "@/lib/events";
import { ROLE_HOME_PATH } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function AdminCalendarPage() {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/calendario");
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
    redirect(ROLE_HOME_PATH[session.user.role] ?? "/unauthorized");
  }

  const role = session.user.role;
  const assignedCategoryIds =
    role === "YOUTH_DIRECTOR" ? await getCoachCategoryIdsForUser(session.user.id) : [];

  // ADMIN: tutte le categorie.
  // YOUTH_DIRECTOR: se ha categorie assegnate le rispetta, altrimenti tutte (come in dashboard eventi).
  const restrictToAssigned = role === "YOUTH_DIRECTOR" && assignedCategoryIds.length > 0;
  const categoryFilter = restrictToAssigned
    ? { categoryId: { in: assignedCategoryIds } }
    : {};

  const currentMonth = currentCalendarMonthStart();
  const { start: rangeStart, end: rangeEnd } = calendarVisibleRangeForMonth(
    currentMonth.getUTCFullYear(),
    currentMonth.getUTCMonth(),
  );

  const [categories, events] = await Promise.all([
    prisma.category.findMany({
      where: {
        isActive: true,
        ...(restrictToAssigned ? { id: { in: assignedCategoryIds } } : {}),
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.event.findMany({
      where: {
        ...categoryFilter,
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
  ]);

  const canManageEvents = role === "ADMIN" || role === "YOUTH_DIRECTOR";

  const calendarEvents: CalendarEvent[] = events.map((event) => ({
    id: `event-${event.id}`,
    title: event.title,
    date: toFloatingDateTime(event.startAt),
    endDate: event.endAt ? toFloatingDateTime(event.endAt) : null,
    type: normalizeCalendarEventType(event.type),
    location: event.location,
    details: event.description,
    categoryId: event.categoryId,
    categoryName: event.category?.name ?? null,
    manageHref:
      canManageEvents && event.categoryId
        ? `/admin/eventi/${event.id}/presenze`
        : null,
    manageLabel: canManageEvents && event.categoryId ? "Gestisci evento" : null,
    editHref: canManageEvents ? `/admin/eventi/${event.id}/modifica` : null,
    deleteEndpoint: canManageEvents ? `/api/events/${event.id}` : null,
  }));

  const subtitle = restrictToAssigned
    ? "Eventi delle categorie giovanili assegnate."
    : "Tutti gli eventi di tutte le categorie.";

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <AreaHeader
          title="Calendario staff"
          subtitle={subtitle}
          userName={session.user.name ?? "Staff"}
        />

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin"
            className="inline-flex items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Torna dashboard
          </Link>
        </div>

        <MonthCalendar
          title="Calendario mensile"
          subtitle="Tap sul giorno per titolo, tipo, categoria, orario e luogo. Filtra per categoria o tipo. Puoi anche modificare o eliminare l'evento."
          events={calendarEvents}
          categoryOptions={categories}
          showTypeFilter
          eventsSourceUrl="/api/calendar/events"
          initialYearMonth={formatYearMonth(currentMonth)}
          emptyMessage="Nessun evento in questo mese."
        />
      </div>
    </main>
  );
}
