import Link from "next/link";
import { AdminBackLink } from "@/components/admin/admin-back-link";
import { AreaHeader } from "@/components/layout/area-header";
import { SiteWebNav } from "@/components/site-web/site-web-nav";
import { prisma } from "@/lib/prisma";
import { extractYoutubeId } from "@/lib/site-cms";
import { requireSiteWebAdminPage } from "@/lib/site-cms-server";

export default async function AdminSiteVideosPage() {
  const session = await requireSiteWebAdminPage("/admin/sito-web/video");

  const videos = await prisma.siteVideo.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <AreaHeader
          title="Video sito web (Admin)"
          subtitle="Video YouTube della pagina Media"
          userName={session.user.name ?? "Amministratore"}
        />
        <AdminBackLink href="/admin/sito-web" label="← Torna a Sito web" />
        <SiteWebNav />

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-zinc-600">{videos.length} video</p>
            <Link
              href="/admin/sito-web/video/nuovo"
              className="inline-flex w-full items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 md:w-fit"
            >
              Nuovo video
            </Link>
          </div>

          {videos.length === 0 ? (
            <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
              Nessun video inserito. Crea il primo con &quot;Nuovo video&quot;.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-blue-100 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-blue-800">
                    <th className="px-3 py-2 font-semibold">Anteprima</th>
                    <th className="px-3 py-2 font-semibold">Titolo</th>
                    <th className="px-3 py-2 font-semibold">Link</th>
                    <th className="px-3 py-2 font-semibold">Stato</th>
                    <th className="px-3 py-2 font-semibold">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50 text-zinc-700">
                  {videos.map((video) => {
                    const youtubeId = extractYoutubeId(video.youtubeUrl);

                    return (
                      <tr key={video.id}>
                        <td className="px-3 py-2">
                          {youtubeId ? (
                            // eslint-disable-next-line @next/next/no-img-element -- anteprima admin
                            <img
                              src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
                              alt={video.title}
                              className="h-10 w-16 rounded-md border border-zinc-200 object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-16 items-center justify-center rounded-md border border-dashed border-zinc-300 text-[9px] font-semibold uppercase text-zinc-400">
                              N/D
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-zinc-900">{video.title}</div>
                          {video.description ? (
                            <div className="max-w-xs truncate text-xs text-zinc-500">{video.description}</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <a
                            href={video.youtubeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-700 underline-offset-2 hover:underline"
                          >
                            Apri su YouTube
                          </a>
                        </td>
                        <td className="px-3 py-2">
                          {video.isVisible ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                              Visibile
                            </span>
                          ) : (
                            <span className="rounded-full border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-700">
                              Nascosto
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Link
                            href={`/admin/sito-web/video/${video.id}/modifica`}
                            className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            Modifica
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
