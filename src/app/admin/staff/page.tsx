import Link from "next/link";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { AreaHeader } from "@/components/layout/area-header";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const STAFF_ROLE_OPTIONS: UserRole[] = ["ADMIN", "YOUTH_DIRECTOR", "COACH"];

const roleLabelMap: Record<UserRole, string> = {
  ADMIN: "Admin",
  YOUTH_DIRECTOR: "Direttore tecnico",
  COACH: "Mister",
  PARENT: "Genitore",
};

type AdminStaffPageProps = {
  searchParams: Promise<{ q?: string; role?: string }>;
};

export default async function AdminStaffPage({ searchParams }: AdminStaffPageProps) {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/staff");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const role = STAFF_ROLE_OPTIONS.includes(params.role as UserRole) ? (params.role as UserRole) : "";

  const staff = await prisma.user.findMany({
    where: {
      AND: [
        {
          role: {
            in: STAFF_ROLE_OPTIONS,
          },
        },
        q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        role ? { role } : {},
      ],
    },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      coachProfile: {
        select: {
          categoryAssignments: {
            orderBy: [{ category: { name: "asc" } }],
            select: {
              category: {
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
          title="Staff Tecnico (Admin)"
          subtitle="Ruoli tecnici e categorie assegnate"
          userName={session.user.name ?? "Amministratore"}
        />

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-zinc-600">{staff.length} profilo/i staff</p>
              <p className="mt-1 text-xs text-zinc-500">Elenco admin, direzione tecnica e mister.</p>
            </div>

            <form method="get" className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
              <input
                name="q"
                defaultValue={q}
                placeholder="Cerca nome o email"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2 md:w-64"
              />
              <select
                name="role"
                defaultValue={role}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
              >
                <option value="">Tutti i ruoli staff</option>
                {STAFF_ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {roleLabelMap[option]}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
              >
                Filtra
              </button>
              {(q || role) && (
                <Link
                  href="/admin/staff"
                  className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                >
                  Reset
                </Link>
              )}
            </form>
          </div>

          {staff.length === 0 ? (
            <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
              Nessun profilo staff trovato con i filtri selezionati.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-blue-100 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-blue-800">
                    <th className="px-3 py-2 font-semibold">Nome</th>
                    <th className="px-3 py-2 font-semibold">Email</th>
                    <th className="px-3 py-2 font-semibold">Ruolo</th>
                    <th className="px-3 py-2 font-semibold">Categorie assegnate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50 text-zinc-700">
                  {staff.map((staffUser) => {
                    const assignedCategories =
                      staffUser.coachProfile?.categoryAssignments
                        .map((assignment) => assignment.category.name)
                        .join(", ") ?? "";

                    return (
                      <tr key={staffUser.id}>
                        <td className="px-3 py-2 font-medium text-zinc-900">{staffUser.name}</td>
                        <td className="px-3 py-2">{staffUser.email}</td>
                        <td className="px-3 py-2">{roleLabelMap[staffUser.role]}</td>
                        <td className="px-3 py-2">{assignedCategories || "-"}</td>
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
