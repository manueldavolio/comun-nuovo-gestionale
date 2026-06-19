import Link from "next/link";
import { AreaHeader } from "@/components/layout/area-header";
import { SiteVideoForm } from "@/components/site-web/site-video-form";
import { requireSiteWebAdminPage } from "@/lib/site-cms-server";

export default async function AdminSiteVideoNewPage() {
  const session = await requireSiteWebAdminPage("/admin/sito-web/video/nuovo");

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <AreaHeader
          title="Nuovo video (Admin)"
          subtitle="Aggiungi un video YouTube al sito"
          userName={session.user.name ?? "Amministratore"}
        />

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Link
            href="/admin/sito-web/video"
            className="inline-flex w-fit items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Torna alla lista
          </Link>
        </div>

        <SiteVideoForm
          mode="create"
          initialValues={{
            title: "",
            youtubeUrl: "",
            description: "",
            isVisible: true,
          }}
        />
      </div>
    </main>
  );
}
