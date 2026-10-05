import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { canManageEventAttendance } from "@/lib/attendance";
import { isGoalkeeperRole, shouldPersistMatchPlayerStat } from "@/lib/athlete-roles";
import {
  resolveEventScoresFromPeriods,
  usesFourPeriodScoring,
  type PeriodScoreInput,
} from "@/lib/four-period-scoring";
import { isMatchEventType } from "@/lib/parent-season";
import { prisma } from "@/lib/prisma";
import { updateAttendanceSchema } from "@/lib/validation/attendance";

export async function PUT(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  if (
    session.user.role !== "ADMIN" &&
    session.user.role !== "YOUTH_DIRECTOR" &&
    session.user.role !== "COACH"
  ) {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { eventId } = await context.params;

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = updateAttendanceSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      categoryId: true,
      type: true,
      isHome: true,
      category: { select: { name: true } },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Evento non trovato." }, { status: 404 });
  }

  const canManage = await canManageEventAttendance({
    userId: session.user.id,
    role: session.user.role,
    eventId: event.id,
  });

  if (!canManage) {
    return NextResponse.json({ error: "Non puoi gestire questo evento." }, { status: 403 });
  }

  if (!event.categoryId) {
    return NextResponse.json(
      { error: "L'evento non e collegato a una categoria." },
      { status: 400 },
    );
  }

  const isMatch = isMatchEventType(event.type);
  const fourPeriod = usesFourPeriodScoring(event.category?.name);

  if (parsed.data.matchResult && !isMatch) {
    return NextResponse.json(
      { error: "Il risultato è disponibile solo per eventi partita." },
      { status: 400 },
    );
  }

  if (parsed.data.periodScores && !isMatch) {
    return NextResponse.json(
      { error: "I risultati per tempi sono disponibili solo per eventi partita." },
      { status: 400 },
    );
  }

  if (fourPeriod) {
    if (
      parsed.data.matchResult &&
      (parsed.data.matchResult.homeScore !== undefined ||
        parsed.data.matchResult.awayScore !== undefined)
    ) {
      return NextResponse.json(
        {
          error:
            "Per Pulcini/Esordienti il risultato classico non è ammesso: usa i quattro tempi.",
        },
        { status: 400 },
      );
    }
  } else if (parsed.data.periodScores) {
    return NextResponse.json(
      { error: "I risultati per tempi non sono disponibili per questa categoria." },
      { status: 400 },
    );
  }

  const athletes = await prisma.athlete.findMany({
    where: {
      categoryId: event.categoryId,
    },
    select: { id: true, position: true },
  });
  const athleteById = new Map(athletes.map((athlete) => [athlete.id, athlete]));

  const hasInvalidAthlete = parsed.data.entries.some((entry) => !athleteById.has(entry.athleteId));
  if (hasInvalidAthlete) {
    return NextResponse.json(
      { error: "Uno o piu atleti non appartengono alla categoria dell'evento." },
      { status: 400 },
    );
  }

  for (const [index, entry] of parsed.data.entries.entries()) {
    const athlete = athleteById.get(entry.athleteId)!;
    const isGk = isGoalkeeperRole(athlete.position);
    if (entry.goalsConceded != null && !isGk) {
      return NextResponse.json(
        {
          error: `Gol subiti ammessi solo per portieri (atleta ${index + 1}).`,
        },
        { status: 400 },
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const entry of parsed.data.entries) {
      await tx.attendance.upsert({
        where: {
          athleteId_eventId: {
            athleteId: entry.athleteId,
            eventId: event.id,
          },
        },
        update: {
          status: entry.status,
        },
        create: {
          athleteId: entry.athleteId,
          eventId: event.id,
          status: entry.status,
        },
      });

      if (isMatch) {
        const athlete = athleteById.get(entry.athleteId)!;
        const isGk = isGoalkeeperRole(athlete.position);
        const present = entry.status === "PRESENT";
        const goals = present ? (entry.goals ?? 0) : 0;
        const assists = present ? (entry.assists ?? 0) : 0;

        const existing = await tx.matchPlayerStat.findUnique({
          where: {
            eventId_athleteId: {
              eventId: event.id,
              athleteId: entry.athleteId,
            },
          },
          select: { goalsConceded: true },
        });

        // Assente → null. Non-POR → omit (undefined) per non cancellare storico
        // se il ruolo è cambiato dopo partite già salvate. Solo POR aggiorna il campo.
        let goalsConceded: number | null | undefined = entry.goalsConceded;
        if (!present) {
          goalsConceded = null;
        } else if (!isGk) {
          goalsConceded = undefined;
        }

        const persist = shouldPersistMatchPlayerStat({
          present,
          goals,
          assists,
          goalsConceded,
          existingGoalsConceded: existing?.goalsConceded ?? null,
        });

        if (!present || !persist) {
          await tx.matchPlayerStat.deleteMany({
            where: {
              eventId: event.id,
              athleteId: entry.athleteId,
            },
          });
        } else {
          const updateData: {
            goals: number;
            assists: number;
            goalsConceded?: number | null;
          } = { goals, assists };
          if (goalsConceded !== undefined) {
            updateData.goalsConceded = goalsConceded;
          }

          await tx.matchPlayerStat.upsert({
            where: {
              eventId_athleteId: {
                eventId: event.id,
                athleteId: entry.athleteId,
              },
            },
            update: updateData,
            create: {
              eventId: event.id,
              athleteId: entry.athleteId,
              goals,
              assists,
              goalsConceded: goalsConceded === undefined ? null : goalsConceded,
            },
          });
        }
      }
    }

    const effectiveIsHome =
      parsed.data.matchResult?.isHome !== undefined
        ? parsed.data.matchResult.isHome
        : event.isHome;

    if (isMatch && parsed.data.matchResult) {
      const result = parsed.data.matchResult;
      if (!fourPeriod) {
        await tx.event.update({
          where: { id: event.id },
          data: {
            opponentName:
              result.opponentName === undefined
                ? undefined
                : result.opponentName?.trim()
                  ? result.opponentName.trim()
                  : null,
            homeScore: result.homeScore === undefined ? undefined : result.homeScore,
            awayScore: result.awayScore === undefined ? undefined : result.awayScore,
            isHome: result.isHome === undefined ? undefined : result.isHome,
          },
        });
      } else {
        await tx.event.update({
          where: { id: event.id },
          data: {
            opponentName:
              result.opponentName === undefined
                ? undefined
                : result.opponentName?.trim()
                  ? result.opponentName.trim()
                  : null,
            isHome: result.isHome === undefined ? undefined : result.isHome,
          },
        });
      }
    }

    if (isMatch && fourPeriod && parsed.data.periodScores) {
      const periods: PeriodScoreInput[] = parsed.data.periodScores.map((row) => ({
        periodNumber: row.periodNumber,
        homeScore: row.homeScore,
        awayScore: row.awayScore,
      }));

      for (const period of periods) {
        await tx.matchPeriodScore.upsert({
          where: {
            eventId_periodNumber: {
              eventId: event.id,
              periodNumber: period.periodNumber,
            },
          },
          update: {
            homeScore: period.homeScore,
            awayScore: period.awayScore,
          },
          create: {
            eventId: event.id,
            periodNumber: period.periodNumber,
            homeScore: period.homeScore,
            awayScore: period.awayScore,
          },
        });
      }

      const stored = await tx.matchPeriodScore.findMany({
        where: { eventId: event.id },
        select: { periodNumber: true, homeScore: true, awayScore: true },
      });

      const { homeScore, awayScore } = resolveEventScoresFromPeriods(stored, effectiveIsHome);

      await tx.event.update({
        where: { id: event.id },
        data: {
          homeScore,
          awayScore,
        },
      });
    } else if (
      isMatch &&
      fourPeriod &&
      parsed.data.matchResult?.isHome !== undefined &&
      !parsed.data.periodScores
    ) {
      const stored = await tx.matchPeriodScore.findMany({
        where: { eventId: event.id },
        select: { periodNumber: true, homeScore: true, awayScore: true },
      });
      if (stored.length > 0) {
        const { homeScore, awayScore } = resolveEventScoresFromPeriods(stored, effectiveIsHome);
        await tx.event.update({
          where: { id: event.id },
          data: { homeScore, awayScore },
        });
      }
    }
  });

  return NextResponse.json({ success: true, updated: parsed.data.entries.length });
}
