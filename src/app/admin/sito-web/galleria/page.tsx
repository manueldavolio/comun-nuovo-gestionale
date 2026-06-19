import Link from "next/link";
import { AdminBackLink } from "@/components/admin/admin-back-link";
import { AreaHeader } from "@/components/layout/area-header";
import { SiteWebNav } from "@/components/site-web/site-web-nav";
import { prisma } from "@/lib/prisma";
import { requireSiteWebAdminPage } from "@/lib/site-cms-server";

function formatDate(value: Date | null): string {
  if (!value) return "-";
  return value.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function AdminSiteGalleryPage() {
  const session = await requireSiteWebAdminPage("/admin/sito-web/galleria");

  const albums = await prisma.siteGalleryAlbum.findMany({
    orderBy: [{ date: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { imageUrl: true },
      },
      _count: { select: { images: true } },
    },
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <AreaHeader
          title="Galleria foto sito web (Admin)"
          subtitle="Album fotografici della pagina Media"
          userName={session.user.name ?? "Amministratore"}
        />
        <AdminBackLink href="/admin/sito-web" label="← Torna a Sito web" />
        <SiteWebNav />

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-zinc-600">{albums.length} album</p>
            <Link
              href="/admin/sito-web/galleria/nuovo"
              className="inline-flex w-full items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 md:w-fit"
            >
              Nuovo album
            </Link>
          </div>

          {albums.length === 0 ? (
            <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
              Nessun album creato. Crea il primo con &quot;Nuovo album&quot;.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {albums.map((album) => (
                <div
                  key={album.id}
                  className="flex flex-col overflow-hidden rounded-xl border border-blue-100 shadow-sm"
                >
                  {album.images[0]?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- anteprima admin
                    <img
                      src={album.images[0].imageUrl}
                      alt={album.title}
                      className="h-36 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-36 w-full items-center justify-center bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Nessuna foto
                    </div>
                  )}

                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <h2 className="font-semibold text-zinc-900">{album.title}</h2>
                    <p className="text-xs text-zinc-500">
                      {formatDate(album.date)} — {album._count.images} foto
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {album.isVisible ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                          Visibile
                        </span>
                      ) : (
                        <span className="rounded-full border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-700">
                          Nascosto
                        </span>
                      )}
                      <Link
                        href={`/admin/sito-web/galleria/${album.id}/modifica`}
                        className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        Gestisci
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
