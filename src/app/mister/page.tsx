import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { DashboardCard } from "@/components/layout/dashboard-card";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

export default async function CoachDashboardPage() {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/mister");
  }

  if (session.user.role !== "COACH") {
    redirect("/unauthorized");
  }

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  const categoriesCount = categories.length;

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <AreaHeader
          title="Area Mister"
          subtitle="Panoramica operativa staff tecnico"
          userName={session.user.name ?? "Mister"}
        />

        <section className="grid gap-4 md:grid-cols-3">
          <DashboardCard
            title="Squadre assegnate"
            value={categoriesCount}
            description="Gruppi attivi disponibili per lo staff"
          />
          <DashboardCard
            title="Presenze ultime 24h"
            value="N/D"
            description="Modulo presenze pronto per integrazione"
          />
          <DashboardCard
            title="Calendario"
            value="In preparazione"
            description="Allenamenti e partite sincronizzati"
          />
        </section>

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Categorie disponibili</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {categories.map((category) => (
              <article
                key={category.id}
                className="rounded-lg border border-blue-100 px-3 py-2"
              >
                <p className="font-medium text-zinc-900">{category.name}</p>
                <p className="text-sm text-zinc-600">
                  {category.description ?? "Nessuna descrizione disponibile."}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
