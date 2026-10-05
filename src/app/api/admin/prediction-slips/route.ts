import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  computeEffectiveClosesAt,
  isEventEligibleForPredictionSlip,
} from "@/lib/prediction-slip";

function unauthorized() {
  return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
}

async function requireAdmin() {
  const session = await getAuthSession();
  if (!session?.user?.id) return { error: unauthorized() as NextResponse };
  if (session.user.role !== "ADMIN") return { error: forbidden() as NextResponse };
  return { session };
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const slips = await prisma.predictionSlip.findMany({
    orderBy: [{ closesAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      prizeText: true,
      closesAt: true,
      effectiveClosesAt: true,
      lockedAt: true,
      isPublished: true,
      createdAt: true,
      _count: {
        select: { events: true, entries: true },
      },
    },
  });

  return NextResponse.json({ success: true, data: slips });
}

type CreatePayload = {
  title?: unknown;
  prizeText?: unknown;
  closesAt?: unknown;
  eventIds?: unknown;
  isPublished?: unknown;
};

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  let payload: CreatePayload;
  try {
    payload = (await request.json()) as CreatePayload;
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const prizeText = typeof payload.prizeText === "string" ? payload.prizeText.trim() : "";
  const closesAtRaw = typeof payload.closesAt === "string" ? payload.closesAt.trim() : "";
  const isPublished = payload.isPublished === true;
  const eventIds = Array.isArray(payload.eventIds)
    ? payload.eventIds
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        .map((id) => id.trim())
    : [];

  if (!title) {
    return NextResponse.json({ error: "Titolo obbligatorio." }, { status: 400 });
  }
  if (!prizeText) {
    return NextResponse.json({ error: "Premio obbligatorio." }, { status: 400 });
  }
  if (!closesAtRaw) {
    return NextResponse.json({ error: "Data/ora di chiusura obbligatoria." }, { status: 400 });
  }

  const closesAt = new Date(closesAtRaw);
  if (Number.isNaN(closesAt.getTime())) {
    return NextResponse.json({ error: "Data/ora di chiusura non valida." }, { status: 400 });
  }

  if (eventIds.length === 0 && isPublished) {
    return NextResponse.json({ error: "Per pubblicare serve almeno una partita." }, { status: 400 });
  }

  const uniqueEventIds = [...new Set(eventIds)];
  if (uniqueEventIds.length !== eventIds.length) {
    return NextResponse.json({ error: "Partite duplicate nella schedina." }, { status: 400 });
  }

  const events = uniqueEventIds.length
    ? await prisma.event.findMany({
        where: { id: { in: uniqueEventIds } },
        select: {
          id: true,
          type: true,
          title: true,
          startAt: true,
          isHome: true,
          opponentName: true,
        },
      })
    : [];

  if (events.length !== uniqueEventIds.length) {
    return NextResponse.json({ error: "Uno o più eventi non esistono." }, { status: 400 });
  }

  const byId = new Map(events.map((event) => [event.id, event]));
  for (const eventId of uniqueEventIds) {
    const event = byId.get(eventId)!;
    const eligible = isEventEligibleForPredictionSlip(event);
    if (!eligible.ok) {
      return NextResponse.json(
        { error: `Evento non ammissibile (${event.title}): ${eligible.reason}` },
        { status: 400 },
      );
    }
  }

  const orderedStartAts = uniqueEventIds.map((id) => byId.get(id)!.startAt);
  const effectiveClosesAt = isPublished
    ? computeEffectiveClosesAt(closesAt, orderedStartAts)
    : null;

  const slip = await prisma.predictionSlip.create({
    data: {
      title,
      prizeText,
      closesAt,
      effectiveClosesAt,
      isPublished,
      createdById: auth.session!.user.id,
      events: {
        create: uniqueEventIds.map((eventId, index) => ({
          eventId,
          sortOrder: index + 1,
        })),
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ success: true, data: { id: slip.id } }, { status: 201 });
}
