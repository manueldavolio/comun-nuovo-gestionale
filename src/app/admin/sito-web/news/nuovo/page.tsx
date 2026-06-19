import Link from "next/link";
import { AreaHeader } from "@/components/layout/area-header";
import { SiteNewsForm } from "@/components/site-web/site-news-form";
import { requireSiteWebAdminPage } from "@/lib/site-cms-server";

export default async function AdminSiteNewsNewPage() {
  const session = await requireSiteWebAdminPage("/admin/sito-web/news/nuovo");

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <AreaHeader
          title="Nuova news (Admin)"
          subtitle="Scrivi un nuovo articolo per il sito"
          userName={session.user.name ?? "Amministratore"}
        />

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Link
            href="/admin/sito-web/news"
            className="inline-flex w-fit items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Torna alla lista
          </Link>
        </div>

        <SiteNewsForm
          mode="create"
          initialValues={{
            title: "",
            subtitle: "",
            content: "",
            coverImageUrl: "",
            category: "Società",
            published: false,
            publishedAt: "",
          }}
        />
      </div>
    </main>
  );
}
