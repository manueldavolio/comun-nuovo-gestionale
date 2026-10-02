import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { parseDateInputToUTC } from "@/lib/date-input";
import {
  birthDatesMatchUtc,
  getParentProfileIdForUser,
  isParentAssociatedToAthlete,
  normalizeAthleteTaxCode,
} from "@/lib/parent-athletes";
import { prisma } from "@/lib/prisma";
import { createParentAthleteLinkRequestSchema } from "@/lib/validation/parent-athlete-links";

const GENERIC_LOOKUP_ERROR =
  "Impossibile creare la richiesta con i dati indicati. Verifica codice fiscale e data di nascita, oppure contatta la segreteria.";

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }
  if (session.user.role !== "PARENT") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const parentProfileId = await getParentProfileIdForUser(session.user.id);
  if (!parentProfileId) {
    return NextResponse.json({ error: "Profilo genitore non trovato." }, { status: 404 });
  }

  const requests = await prisma.parentAthleteLinkRequest.findMany({
    where: { requesterParentId: parentProfileId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      createdAt: true,
      reviewedAt: true,
      athlete: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return NextResponse.json({
    success: true,
    data: requests.map((request) => ({
      id: request.id,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
      reviewedAt: request.reviewedAt?.toISOString() ?? null,
      // Shown only for requests created by this parent (already knows the child).
      athleteLabel:
        request.status === "APPROVED" || request.status === "PENDING" || request.status === "REJECTED"
          ? `${request.athlete.firstName} ${request.athlete.lastName}`.trim()
          : null,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }
  if (session.user.role !== "PARENT") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = createParentAthleteLinkRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const parentProfileId = await getParentProfileIdForUser(session.user.id);
  if (!parentProfileId) {
    return NextResponse.json({ error: "Profilo genitore non trovato." }, { status: 404 });
  }

  const birthDate = parseDateInputToUTC(parsed.data.athleteBirthDate);
  if (!birthDate) {
    return NextResponse.json({ error: "Data di nascita non valida." }, { status: 400 });
  }

  const taxCode = normalizeAthleteTaxCode(parsed.data.athleteTaxCode);
  const athlete = await prisma.athlete.findUnique({
    where: { taxCode },
    select: {
      id: true,
      birthDate: true,
      parentId: true,
    },
  });

  // Generic response: do not reveal whether CF exists / birth date mismatch.
  if (!athlete || !birthDatesMatchUtc(athlete.birthDate, birthDate)) {
    return NextResponse.json({ error: GENERIC_LOOKUP_ERROR }, { status: 404 });
  }

  const alreadyAssociated = await isParentAssociatedToAthlete({
    parentProfileId,
    athleteId: athlete.id,
  });
  if (alreadyAssociated) {
    return NextResponse.json(
      { error: "Risulti già associato a questo atleta." },
      { status: 409 },
    );
  }

  const pending = await prisma.parentAthleteLinkRequest.findFirst({
    where: {
      requesterParentId: parentProfileId,
      athleteId: athlete.id,
      status: "PENDING",
    },
    select: { id: true },
  });
  if (pending) {
    return NextResponse.json(
      { error: "Hai già una richiesta in attesa per questo atleta." },
      { status: 409 },
    );
  }

  try {
    const created = await prisma.parentAthleteLinkRequest.create({
      data: {
        requesterParentId: parentProfileId,
        athleteId: athlete.id,
        status: "PENDING",
      },
      select: { id: true, status: true, createdAt: true },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: created.id,
          status: created.status,
          createdAt: created.createdAt.toISOString(),
        },
        message: "Richiesta inviata. Sarà valutata dalla segreteria.",
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: GENERIC_LOOKUP_ERROR }, { status: 400 });
  }
}
