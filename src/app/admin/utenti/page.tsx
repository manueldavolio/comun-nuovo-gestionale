import Link from "next/link";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { AdminUserRowActions } from "@/components/admin/admin-user-row-actions";
import { AreaHeader } from "@/components/layout/area-header";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roleLabelMap } from "@/lib/staff";

const ROLE_OPTIONS: UserRole[] = ["ADMIN", "YOUTH_DIRECTOR", "COACH", "PARENT"];

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

type AdminUsersPageProps = {
  searchParams: Promise<{ q?: string; role?: string; status?: string }>;
};

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/utenti");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const role = ROLE_OPTIONS.includes(params.role as UserRole) ? (params.role as UserRole) : "";
  const status = params.status === "active" || params.status === "inactive" ? params.status : "";

  const users = await prisma.user.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        role ? { role } : {},
        status ? { isActive: status === "active" } : {},
      ],
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <AreaHeader
          title="Utenti (Admin)"
          subtitle="Elenco utenti piattaforma"
          userName={session.user.name ?? "Amministratore"}
        />

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-zinc-600">{users.length} utente/i</p>
              <p className="mt-1 text-xs text-zinc-500">Cerca per nome o email, con filtro ruolo opzionale.</p>
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
                <option value="">Tutti i ruoli</option>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {roleLabelMap[option]}
                  </option>
                ))}
              </select>
              <select
                name="status"
                defaultValue={status}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
              >
                <option value="">Tutti gli stati</option>
                <option value="active">Attivi</option>
                <option value="inactive">Non attivi</option>
              </select>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
              >
                Filtra
              </button>
              {(q || role || status) && (
                <Link
                  href="/admin/utenti"
                  className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                >
                  Reset
                </Link>
              )}
            </form>
          </div>

          {users.length === 0 ? (
            <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
              Nessun utente trovato con i filtri selezionati.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-blue-100 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-blue-800">
                    <th className="px-3 py-2 font-semibold">Nome</th>
                    <th className="px-3 py-2 font-semibold">Email</th>
                    <th className="px-3 py-2 font-semibold">Ruolo</th>
                    <th className="px-3 py-2 font-semibold">Stato</th>
                    <th className="px-3 py-2 font-semibold">Creato il</th>
                    <th className="px-3 py-2 font-semibold">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50 text-zinc-700">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-3 py-2 font-medium text-zinc-900">{user.name}</td>
                      <td className="px-3 py-2">{user.email}</td>
                      <td className="px-3 py-2">{roleLabelMap[user.role]}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                            user.isActive
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-zinc-200 text-zinc-700"
                          }`}
                        >
                          {user.isActive ? "Attivo" : "Non attivo"}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {dateFormatter.format(new Date(user.createdAt))}
                      </td>
                      <td className="px-3 py-2">
                        <AdminUserRowActions
                          userId={user.id}
                          initialRole={user.role}
                          initialIsActive={user.isActive}
                          isCurrentUser={session.user.id === user.id}
                        />
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
