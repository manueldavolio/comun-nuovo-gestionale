import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

type AdminAthletesPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function AdminAthletesPage({ searchParams }: AdminAthletesPageProps) {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/atleti");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const params = await searchParams;
  const q = (params.q ?? "").trim();

  const athletes = await prisma.athlete.findMany({
    where: q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      category: {
        select: {
          name: true,
          seasonLabel: true,
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <AreaHeader title="Atleti (Admin)" subtitle="Anagrafiche e documenti" userName={session.user.name ?? "Amministratore"} />

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-zinc-600">
                {athletes.length} atleta/i
              </p>
              {q ? (
                <p className="mt-1 text-xs text-zinc-500">Filtro attivo: {q}</p>
              ) : (
                <p className="mt-1 text-xs text-zinc-500">Nessun filtro</p>
              )}
            </div>

            <form method="get" className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <input
                name="q"
                defaultValue={q}
                placeholder="Cerca per nome o cognome"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2 sm:w-72"
              />
              <button
                type="submit"
                className="inline-flex w-fit items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
              >
                Cerca
              </button>
              {q ? (
                <Link
                  href="/admin/atleti"
                  className="inline-flex w-fit items-center justify-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                >
                  Reset
                </Link>
              ) : null}
            </form>
          </div>

          {athletes.length === 0 ? (
            <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
              Nessun atleta trovato.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-blue-100 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-blue-800">
                    <th className="px-3 py-2 font-semibold">Nome</th>
                    <th className="px-3 py-2 font-semibold">Cognome</th>
                    <th className="px-3 py-2 font-semibold">Categoria</th>
                    <th className="px-3 py-2 font-semibold">Data di nascita</th>
                    <th className="px-3 py-2 font-semibold">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50 text-zinc-700">
                  {athletes.map((athlete) => (
                    <tr key={athlete.id}>
                      <td className="px-3 py-2 font-medium text-zinc-900">{athlete.firstName}</td>
                      <td className="px-3 py-2 font-medium text-zinc-900">{athlete.lastName}</td>
                      <td className="px-3 py-2">
                        <span className="whitespace-nowrap">
                          {athlete.category.name} ({athlete.category.seasonLabel})
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {dateFormatter.format(new Date(athlete.birthDate))}
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/admin/atleti/${athlete.id}`}
                          className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          Dettaglio
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

