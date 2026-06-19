import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { DeleteButton } from "@/components/common/delete-button";
import { SitePlayerForm } from "@/components/site-web/site-player-form";
import { prisma } from "@/lib/prisma";
import { requireSiteWebAdminPage } from "@/lib/site-cms-server";

type AdminSitePlayerEditPageProps = {
  params: Promise<{ playerId: string }>;
};

export default async function AdminSitePlayerEditPage({ params }: AdminSitePlayerEditPageProps) {
  const { playerId } = await params;
  const session = await requireSiteWebAdminPage(`/admin/sito-web/giocatori/${playerId}/modifica`);

  const player = await prisma.sitePlayer.findUnique({ where: { id: playerId } });
  if (!player) {
    redirect("/admin/sito-web/giocatori");
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <AreaHeader
          title="Modifica giocatore (Admin)"
          subtitle="Aggiorna i dati del giocatore"
          userName={session.user.name ?? "Amministratore"}
        />

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Link
            href="/admin/sito-web/giocatori"
            className="inline-flex w-fit items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Torna alla lista
          </Link>
        </div>

        <SitePlayerForm
          mode="edit"
          playerId={player.id}
          initialValues={{
            name: player.name,
            role: player.role,
            team: player.team,
            shirtNumber: player.shirtNumber !== null ? String(player.shirtNumber) : "",
            description: player.description ?? "",
            photoUrl: player.photoUrl ?? "",
            isVisible: player.isVisible,
          }}
        />

        <div className="rounded-xl border border-red-200 bg-white p-4">
          <DeleteButton
            endpoint={`/api/admin/site/players/${player.id}`}
            confirmMessage={`Eliminare il giocatore "${player.name}" dal sito?`}
            successMessage="Giocatore eliminato. Torna alla lista per vedere l'elenco aggiornato."
          />
        </div>
      </div>
    </main>
  );
}
