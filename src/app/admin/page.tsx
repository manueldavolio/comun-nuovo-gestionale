import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { DashboardCard } from "@/components/layout/dashboard-card";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { ROLE_HOME_PATH } from "@/lib/permissions";

export default async function AdminDashboardPage() {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
    redirect(ROLE_HOME_PATH[session.user.role]);
  }

  const [totalUsers, totalCategories, activeCategories, activeStaff] = await Promise.all([
    prisma.user.count(),
    prisma.category.count(),
    prisma.category.count({ where: { isActive: true } }),
    prisma.user.count({
      where: {
        isActive: true,
        role: {
          in: ["ADMIN", "YOUTH_DIRECTOR", "COACH"],
        },
      },
    }),
  ]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <AreaHeader
          title="Dashboard Admin"
          subtitle="Gestione società sportiva"
          userName={session.user.name ?? "Amministratore"}
        />
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DashboardCard
            title="Utenti totali"
            value={totalUsers}
            description="Anagrafiche presenti a sistema"
          />
          <DashboardCard
            title="Categorie totali"
            value={totalCategories}
            description="Fasce/squadre censite"
          />
          <DashboardCard
            title="Categorie attive"
            value={activeCategories}
            description="Categorie operative in stagione"
          />
          <DashboardCard
            title="Staff attivo"
            value={activeStaff}
            description="Admin, direzione tecnica e mister attivi"
          />
        </section>

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Azioni consigliate</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>- Verifica credenziali e stato attivo degli utenti nuovi.</li>
            <li>- Aggiorna categorie prima dell&apos;apertura iscrizioni.</li>
            <li>- Controlla che i ruoli siano coerenti con l&apos;organigramma.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
