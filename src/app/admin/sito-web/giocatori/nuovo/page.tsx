import Link from "next/link";
import { AreaHeader } from "@/components/layout/area-header";
import { SitePlayerForm } from "@/components/site-web/site-player-form";
import { requireSiteWebAdminPage } from "@/lib/site-cms-server";

export default async function AdminSitePlayerNewPage() {
  const session = await requireSiteWebAdminPage("/admin/sito-web/giocatori/nuovo");

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <AreaHeader
          title="Nuovo giocatore (Admin)"
          subtitle="Aggiungi un giocatore alla rosa del sito"
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
          mode="create"
          initialValues={{
            name: "",
            role: "PORTIERE",
            team: "PRIMA_SQUADRA",
            shirtNumber: "",
            description: "",
            photoUrl: "",
            isVisible: true,
          }}
        />
      </div>
    </main>
  );
}
