import { redirect } from "next/navigation";
import { MatchFormationEditor } from "@/components/mister/match-formation-editor";
import { getAuthSession } from "@/lib/auth";
import { canManageEventAttendance } from "@/lib/attendance";
import {
  resolveOperationalStatus,
  OPERATIONAL_STATUS_LABEL,
} from "@/lib/athlete-operational-status";
import { resolvePlayersPerSide } from "@/lib/category-format";
import { nowAsEuropeRomeWallClockUtc } from "@/lib/date-input";
import {
  athleteNotInConvocationWarning,
  buildStarterSlotsForModule,
  defaultModuleForPlayersPerSide,
  isFormationModuleId,
  isMatchFormationEventType,
  isModuleCompatibleWithPlayersPerSide,
  type FormationModuleId,
} from "@/lib/match-formation";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MisterFormationPage({ params }: PageProps) {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/mister");
  }
  if (
    session.user.role !== "COACH" &&
    session.user.role !== "ADMIN" &&
    session.user.role !== "YOUTH_DIRECTOR"
  ) {
    redirect("/unauthorized");
  }

  const { id: eventId } = await params;
  const canManage = await canManageEventAttendance({
    userId: session.user.id,
    role: session.user.role,
    eventId,
  });
  if (!canManage) {
    redirect("/unauthorized");
  }

  const wallNow = nowAsEuropeRomeWallClockUtc();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      type: true,
      opponentName: true,
      categoryId: true,
      category: { select: { id: true, name: true, playersPerSide: true } },
      convocation: {
        select: {
          id: true,
          athletes: { select: { athleteId: true } },
        },
      },
      matchFormation: {
        select: {
          module: true,
          slots: {
            orderBy: { sortOrder: "asc" },
            select: {
              slotKey: true,
              athleteId: true,
              isBench: true,
            },
          },
        },
      },
    },
  });

  if (!event || !isMatchFormationEventType(event.type) || !event.categoryId) {
    redirect("/unauthorized");
  }

  const convocatedIds = new Set(
    event.convocation?.athletes.map((a) => a.athleteId) ?? [],
  );
  const hasConvocation = Boolean(event.convocation);

  const [poolAthletes, rosterAthletes] = await Promise.all([
    prisma.athlete.findMany({
      where:
        hasConvocation && convocatedIds.size > 0
          ? { id: { in: [...convocatedIds] }, categoryId: event.categoryId }
          : { categoryId: event.categoryId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        position: true,
        shirtNumber: true,
        operationalStatus: {
          select: { status: true, note: true, validUntil: true },
        },
      },
    }),
    prisma.athlete.findMany({
      where: { categoryId: event.categoryId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        position: true,
        shirtNumber: true,
        operationalStatus: {
          select: { status: true, note: true, validUntil: true },
        },
      },
    }),
  ]);

  const mapAthlete = (
    athlete: (typeof rosterAthletes)[number],
    inConvocation: boolean | null,
  ) => {
    const resolved = resolveOperationalStatus({
      record: athlete.operationalStatus,
      wallNow,
    });
    return {
      id: athlete.id,
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      position: athlete.position,
      shirtNumber: athlete.shirtNumber,
      operationalLabel: OPERATIONAL_STATUS_LABEL[resolved.status],
      inConvocation,
      notInConvocationWarning:
        hasConvocation && inConvocation === false
          ? athleteNotInConvocationWarning(athlete.id, convocatedIds)
          : null,
    };
  };

  const pool = poolAthletes.map((a) =>
    mapAthlete(a, hasConvocation ? convocatedIds.has(a.id) : null),
  );
  const roster = rosterAthletes.map((a) =>
    mapAthlete(a, hasConvocation ? convocatedIds.has(a.id) : null),
  );

  const playersPerSide = resolvePlayersPerSide(event.category);
  const defaultModule = defaultModuleForPlayersPerSide(playersPerSide);

  const savedModule =
    event.matchFormation && isFormationModuleId(event.matchFormation.module)
      ? event.matchFormation.module
      : null;
  const savedModuleIncompatible = Boolean(
    savedModule && !isModuleCompatibleWithPlayersPerSide(savedModule, playersPerSide),
  );

  // Mantieni il modulo salvato (anche incompatibile) per non distruggere i dati in UI;
  // l'editor forza la scelta di un modulo compatibile prima del salvataggio.
  const initialModule: FormationModuleId = savedModule ?? defaultModule;

  const initialSlots =
    event.matchFormation?.slots.map((slot) => ({
      slotKey: slot.slotKey,
      athleteId: slot.athleteId,
      isBench: slot.isBench,
    })) ??
    buildStarterSlotsForModule(defaultModule).map((t) => ({
      slotKey: t.slotKey,
      athleteId: null as string | null,
      isBench: false,
    }));

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50 p-4 md:p-8">
      <div className="mx-auto w-full max-w-[720px]">
        <MatchFormationEditor
          eventId={event.id}
          eventTitle={event.title}
          opponentName={event.opponentName}
          categoryName={event.category?.name ?? null}
          playersPerSide={playersPerSide}
          backHref={`/mister/eventi/${event.id}/presenze`}
          hasConvocation={hasConvocation}
          pool={pool}
          roster={roster}
          initialModule={initialModule}
          initialSlots={initialSlots}
          savedModuleIncompatible={savedModuleIncompatible}
        />
      </div>
    </main>
  );
}
