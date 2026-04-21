import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { CategoryStatusToggleButton } from "@/components/categories/category-status-toggle-button";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const statusLabelMap = {
  all: "Tutte",
  active: "Attive",
  inactive: "Non attive",
} as const;

type StatusFilter = keyof typeof statusLabelMap;

function parseStatus(value: string | undefined): StatusFilter {
  if (value === "active" || value === "inactive") {
    return value;
  }

  return "all";
}

type AdminCategoriesPageProps = {
  searchParams: Promise<{ q?: string; status?: string }>;
};

export default async function AdminCategoriesPage({ searchParams }: AdminCategoriesPageProps) {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/categorie");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const status = parseStatus(params.status);

  const categories = await prisma.category.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { birthYearsLabel: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        status === "active" ? { isActive: true } : {},
        status === "inactive" ? { isActive: false } : {},
      ],
    },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      birthYearsLabel: true,
      seasonLabel: true,
      isActive: true,
      _count: {
        select: {
          athletes: true,
        },
      },
      coachAssignments: {
        orderBy: [{ coach: { lastName: "asc" } }, { coach: { firstName: "asc" } }],
        select: {
          coach: {
            select: {
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <AreaHeader
          title="Categorie (Admin)"
          subtitle="Fasce annata e assegnazioni tecniche"
          userName={session.user.name ?? "Amministratore"}
        />

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-zinc-600">{categories.length} categoria/e</p>
              <p className="mt-1 text-xs text-zinc-500">
                Stato selezionato: <span className="font-semibold">{statusLabelMap[status]}</span>
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 md:w-auto md:items-end">
              <Link
                href="/admin/categorie/nuovo"
                className="inline-flex w-full items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 md:w-fit"
              >
                Nuova categoria
              </Link>

              <form method="get" className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Cerca nome o fascia annata"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2 md:w-64"
                />
                <select
                  name="status"
                  defaultValue={status}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                >
                  <option value="all">Tutte</option>
                  <option value="active">Attive</option>
                  <option value="inactive">Non attive</option>
                </select>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
                >
                  Filtra
                </button>
                {(q || status !== "all") && (
                  <Link
                    href="/admin/categorie"
                    className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    Reset
                  </Link>
                )}
              </form>
            </div>
          </div>

          {categories.length === 0 ? (
            <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
              Nessuna categoria trovata con i filtri selezionati.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-blue-100 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-blue-800">
                    <th className="px-3 py-2 font-semibold">Nome</th>
                    <th className="px-3 py-2 font-semibold">Fascia annata</th>
                    <th className="px-3 py-2 font-semibold">Stato</th>
                    <th className="px-3 py-2 font-semibold">Atleti iscritti</th>
                    <th className="px-3 py-2 font-semibold">Mister assegnato</th>
                    <th className="px-3 py-2 font-semibold">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50 text-zinc-700">
                  {categories.map((category) => {
                    const assignedCoaches = category.coachAssignments
                      .map((assignment) => assignment.coach.user.name.trim())
                      .filter(Boolean)
                      .join(", ");

                    return (
                      <tr key={category.id}>
                        <td className="px-3 py-2 font-medium text-zinc-900">{category.name}</td>
                        <td className="px-3 py-2">
                          <div>{category.birthYearsLabel}</div>
                          <div className="text-xs text-zinc-500">Stagione {category.seasonLabel}</div>
                        </td>
                        <td className="px-3 py-2">
                          {category.isActive ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                              Attiva
                            </span>
                          ) : (
                            <span className="rounded-full border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-700">
                              Non attiva
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">{category._count.athletes}</td>
                        <td className="px-3 py-2">{assignedCoaches || "-"}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col items-start gap-2">
                            <Link
                              href={`/admin/categorie/${category.id}/modifica`}
                              className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                            >
                              Modifica
                            </Link>
                            <CategoryStatusToggleButton categoryId={category.id} isActive={category.isActive} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
