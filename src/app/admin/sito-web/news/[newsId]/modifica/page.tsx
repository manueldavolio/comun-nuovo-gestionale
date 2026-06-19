import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { DeleteButton } from "@/components/common/delete-button";
import { SiteNewsForm } from "@/components/site-web/site-news-form";
import { prisma } from "@/lib/prisma";
import { requireSiteWebAdminPage } from "@/lib/site-cms-server";

type AdminSiteNewsEditPageProps = {
  params: Promise<{ newsId: string }>;
};

export default async function AdminSiteNewsEditPage({ params }: AdminSiteNewsEditPageProps) {
  const { newsId } = await params;
  const session = await requireSiteWebAdminPage(`/admin/sito-web/news/${newsId}/modifica`);

  const news = await prisma.siteNews.findUnique({ where: { id: newsId } });
  if (!news) {
    redirect("/admin/sito-web/news");
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <AreaHeader
          title="Modifica news (Admin)"
          subtitle="Aggiorna l'articolo del sito"
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
          mode="edit"
          newsId={news.id}
          initialValues={{
            title: news.title,
            subtitle: news.subtitle ?? "",
            content: news.content,
            coverImageUrl: news.coverImageUrl ?? "",
            category: news.category,
            published: news.published,
            publishedAt: news.publishedAt ? news.publishedAt.toISOString().slice(0, 10) : "",
          }}
        />

        <div className="rounded-xl border border-red-200 bg-white p-4">
          <DeleteButton
            endpoint={`/api/admin/site/news/${news.id}`}
            confirmMessage={`Eliminare la news "${news.title}"?`}
            successMessage="News eliminata."
          />
        </div>
      </div>
    </main>
  );
}
