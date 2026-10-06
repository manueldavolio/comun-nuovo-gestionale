import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { AthleteRosterEditor } from "@/components/mister/athlete-roster-editor";
import { getAuthSession } from "@/lib/auth";
import { getCoachCategoryIdsForUser } from "@/lib/attendance";
import {
  resolveOperationalStatus,
  validUntilDateInputValue,
} from "@/lib/athlete-operational-status";
import { nowAsEuropeRomeWallClockUtc } from "@/lib/date-input";
import { prisma } from "@/lib/prisma";

type MisterSquadraPageProps = {
  searchParams?: Promise<{ categoryId?: string }>;
};

export default async function MisterSquadraPage({ searchParams }: MisterSquadraPageProps) {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/mister/squadra");
  }

  if (session.user.role !== "COACH") {
    redirect("/unauthorized");
  }

  const coachCategoryIds = await getCoachCategoryIdsForUser(session.user.id);
  const params = searchParams ? await searchParams : {};
  const requestedCategoryId = (params.categoryId ?? "").trim();
  const selectedCategoryId =
    requestedCategoryId && coachCategoryIds.includes(requestedCategoryId)
      ? requestedCategoryId
      : coachCategoryIds[0] ?? "";

  const wallNow = nowAsEuropeRomeWallClockUtc();
  const noteYear = wallNow.getUTCFullYear();
  const noteMonth = wallNow.getUTCMonth() + 1;

  const categories =
    coachCategoryIds.length === 0
      ? []
      : await prisma.category.findMany({
          where: { id: { in: coachCategoryIds } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, birthYearsLabel: true },
        });

  if (!selectedCategoryId) {
    return (
      <main className="p-4 md:p-8">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
          <AreaHeader
            title="La mia squadra"
            subtitle="Rosa, disponibilità e messaggi"
            userName={session.user.name ?? "Mister"}
          />
          <p className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
            Nessuna categoria assegnata. Contatta l&apos;amministrazione.
          </p>
        </div>
      </main>
    );
  }

  const athletes = await prisma.athlete.findMany({
    where: { categoryId: selectedCategoryId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      position: true,
      shirtNumber: true,
      coachNotes: {
        where: { year: noteYear, month: noteMonth },
        select: { content: true, positiveTags: true },
        take: 1,
      },
      personalGoals: {
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          text: true,
          status: true,
        },
      },
      operationalStatus: {
        select: {
          status: true,
          note: true,
          validUntil: true,
        },
      },
    },
  });

  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);
  const rosterAthletes = athletes.map((athlete) => {
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
      noteContent: athlete.coachNotes[0]?.content ?? null,
      positiveTags: athlete.coachNotes[0]?.positiveTags ?? [],
      goals: athlete.personalGoals.map((goal) => ({
        id: goal.id,
        text: goal.text,
        status: goal.status,
      })),
      operationalStatus: resolved.status,
      operationalNote: resolved.note,
      operationalValidUntilDate: resolved.validUntil
        ? validUntilDateInputValue(resolved.validUntil)
        : null,
    };
  });

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
        <header className="rounded-2xl border border-blue-700 bg-blue-800 p-5 text-white shadow-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200">
            Area Mister
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">La mia squadra</h1>
          <p className="mt-1 text-sm text-sky-100">
            {selectedCategory?.name ?? "Categoria"} · disponibilità, obiettivi e messaggio
          </p>
          <Link
            href="/mister/libreria-esercizi"
            className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-white/30 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/15"
          >
            Libreria esercizi
          </Link>
        </header>

        {categories.length > 1 ? (
          <form method="get" className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <label className="text-sm font-medium text-zinc-700">
              Categoria
              <select
                name="categoryId"
                defaultValue={selectedCategoryId}
                className="mt-1 block min-h-11 w-full max-w-md rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name} ({category.birthYearsLabel})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="mt-3 min-h-11 rounded-xl bg-blue-800 px-4 text-sm font-bold text-white hover:bg-blue-900"
            >
              Mostra rosa
            </button>
          </form>
        ) : null}

        <AthleteRosterEditor
          athletes={rosterAthletes}
          noteYear={noteYear}
          noteMonth={noteMonth}
        />

        <Link
          href="/mister/riepilogo"
          className="text-sm font-semibold text-blue-700 hover:underline"
        >
          Vai al riepilogo analitico (% presenza)
        </Link>
      </div>
    </main>
  );
}
