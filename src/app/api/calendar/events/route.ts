import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getCoachCategoryIdsForUser } from "@/lib/attendance";
import { normalizeCalendarEventType } from "@/lib/calendar-event-type";
import {
  calendarVisibleRangeForMonth,
  currentCalendarMonthStart,
  formatYearMonth,
  parseYearMonthParam,
} from "@/lib/calendar-range";
import { toFloatingDateTime } from "@/lib/date-input";
import { COACH_VISIBLE_EVENT_TYPES } from "@/lib/events";
import { isMatchEventType } from "@/lib/parent-season";
import { prisma } from "@/lib/prisma";
import type { CalendarEvent } from "@/components/calendar/month-calendar";

export const runtime = "nodejs";

/**
 * GET /api/calendar/events?month=YYYY-MM
 * Carica eventi del mese richiesto (griglia lun–dom), senza tetto artificiale globale.
 */
export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "YOUTH_DIRECTOR" && role !== "COACH") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const url = new URL(request.url);
  const parsedMonth =
    parseYearMonthParam(url.searchParams.get("month")) ??
    (() => {
      const current = currentCalendarMonthStart();
      return { year: current.getUTCFullYear(), monthIndex0: current.getUTCMonth() };
    })();

  const { start, end } = calendarVisibleRangeForMonth(
    parsedMonth.year,
    parsedMonth.monthIndex0,
  );

  let categoryIds: string[] | null = null;
  if (role === "COACH") {
    categoryIds = await getCoachCategoryIdsForUser(session.user.id);
    if (categoryIds.length === 0) {
      return NextResponse.json({
        month: formatYearMonth(
          new Date(Date.UTC(parsedMonth.year, parsedMonth.monthIndex0, 1)),
        ),
        events: [] as CalendarEvent[],
      });
    }
  } else if (role === "YOUTH_DIRECTOR") {
    const assigned = await getCoachCategoryIdsForUser(session.user.id);
    if (assigned.length > 0) {
      categoryIds = assigned;
    }
  }

  const events = await prisma.event.findMany({
    where: {
      type: { in: COACH_VISIBLE_EVENT_TYPES },
      startAt: { gte: start, lte: end },
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
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
      category: { select: { name: true } },
    },
  });

  const canManage = role === "ADMIN" || role === "YOUTH_DIRECTOR" || role === "COACH";
  const isCoach = role === "COACH";

  const calendarEvents: CalendarEvent[] = events.map((event) => {
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
      manageHref: canManage
        ? isCoach
          ? `/mister/eventi/${event.id}/presenze`
          : `/admin/eventi/${event.id}/presenze`
        : null,
      manageLabel: canManage
        ? isCoach
          ? match
            ? "Gestisci partita"
            : "Registra presenze"
          : "Gestisci evento"
        : null,
      editHref: canManage
        ? isCoach
          ? `/mister/eventi/${event.id}/modifica`
          : `/admin/eventi/${event.id}/modifica`
        : null,
      deleteEndpoint: canManage ? `/api/events/${event.id}` : null,
      convocationHref: isCoach ? `/mister/eventi/${event.id}/convocazioni` : null,
    };
  });

  return NextResponse.json({
    month: formatYearMonth(
      new Date(Date.UTC(parsedMonth.year, parsedMonth.monthIndex0, 1)),
    ),
    events: calendarEvents,
  });
}
