import Link from "next/link";
import { AreaHeader } from "@/components/layout/area-header";
import { SiteAlbumForm } from "@/components/site-web/site-album-form";
import { requireSiteWebAdminPage } from "@/lib/site-cms-server";

export default async function AdminSiteAlbumNewPage() {
  const session = await requireSiteWebAdminPage("/admin/sito-web/galleria/nuovo");

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <AreaHeader
          title="Nuovo album (Admin)"
          subtitle="Crea un album fotografico per il sito"
          userName={session.user.name ?? "Amministratore"}
        />

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Link
            href="/admin/sito-web/galleria"
            className="inline-flex w-fit items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Torna alla lista
          </Link>
        </div>

        <SiteAlbumForm
          mode="create"
          initialValues={{
            title: "",
            date: "",
            isVisible: true,
          }}
        />
      </div>
    </main>
  );
}
