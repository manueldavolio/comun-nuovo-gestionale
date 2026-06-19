import Link from "next/link";
import { AdminBackLink } from "@/components/admin/admin-back-link";
import { AreaHeader } from "@/components/layout/area-header";
import { SiteWebNav } from "@/components/site-web/site-web-nav";
import { prisma } from "@/lib/prisma";
import { requireSiteWebAdminPage } from "@/lib/site-cms-server";

const statusLabelMap = {
  all: "Tutte",
  published: "Pubblicate",
  draft: "Bozze",
} as const;

type StatusFilter = keyof typeof statusLabelMap;

function parseStatus(value: string | undefined): StatusFilter {
  if (value === "published" || value === "draft") {
    return value;
  }
  return "all";
}

function formatDate(value: Date | null): string {
  if (!value) return "-";
  return value.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type AdminSiteNewsPageProps = {
  searchParams: Promise<{ q?: string; stato?: string }>;
};

export default async function AdminSiteNewsPage({ searchParams }: AdminSiteNewsPageProps) {
  const session = await requireSiteWebAdminPage("/admin/sito-web/news");

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const status = parseStatus(params.stato);

  const newsItems = await prisma.siteNews.findMany({
    where: {
      AND: [
        q ? { title: { contains: q, mode: "insensitive" } } : {},
        status === "published" ? { published: true } : {},
        status === "draft" ? { published: false } : {},
      ],
    },
    orderBy: [{ publishedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <AreaHeader
          title="News sito web (Admin)"
          subtitle="Articoli e comunicati del sito pubblico"
          userName={session.user.name ?? "Amministratore"}
        />
        <AdminBackLink href="/admin/sito-web" label="← Torna a Sito web" />
        <SiteWebNav />

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-zinc-600">{newsItems.length} news</p>
              <p className="mt-1 text-xs text-zinc-500">
                Stato: <span className="font-semibold">{statusLabelMap[status]}</span>
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 md:w-auto md:items-end">
              <Link
                href="/admin/sito-web/news/nuovo"
                className="inline-flex w-full items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 md:w-fit"
              >
                Nuova news
              </Link>

              <form method="get" className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Cerca titolo"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2 md:w-64"
                />
                <select
                  name="stato"
                  defaultValue={status}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                >
                  <option value="all">Tutte</option>
                  <option value="published">Pubblicate</option>
                  <option value="draft">Bozze</option>
                </select>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
                >
                  Filtra
                </button>
              </form>
            </div>
          </div>

          {newsItems.length === 0 ? (
            <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
              Nessuna news trovata. Crea la prima con &quot;Nuova news&quot;.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-blue-100 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-blue-800">
                    <th className="px-3 py-2 font-semibold">Copertina</th>
                    <th className="px-3 py-2 font-semibold">Titolo</th>
                    <th className="px-3 py-2 font-semibold">Categoria</th>
                    <th className="px-3 py-2 font-semibold">Stato</th>
                    <th className="px-3 py-2 font-semibold">Data pubblicazione</th>
                    <th className="px-3 py-2 font-semibold">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50 text-zinc-700">
                  {newsItems.map((news) => (
                    <tr key={news.id}>
                      <td className="px-3 py-2">
                        {news.coverImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- anteprima admin
                          <img
                            src={news.coverImageUrl}
                            alt={news.title}
                            className="h-10 w-16 rounded-md border border-zinc-200 object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-16 items-center justify-center rounded-md border border-dashed border-zinc-300 text-[9px] font-semibold uppercase text-zinc-400">
                            N/D
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-zinc-900">{news.title}</div>
                        <div className="text-xs text-zinc-500">/news/{news.slug}</div>
                      </td>
                      <td className="px-3 py-2">{news.category}</td>
                      <td className="px-3 py-2">
                        {news.published ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                            Pubblicata
                          </span>
                        ) : (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                            Bozza
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">{formatDate(news.publishedAt)}</td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/admin/sito-web/news/${news.id}/modifica`}
                          className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          Modifica
                        </Link>
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
