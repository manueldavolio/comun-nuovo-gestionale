import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { DeleteButton } from "@/components/common/delete-button";
import { SiteVideoForm } from "@/components/site-web/site-video-form";
import { prisma } from "@/lib/prisma";
import { requireSiteWebAdminPage } from "@/lib/site-cms-server";

type AdminSiteVideoEditPageProps = {
  params: Promise<{ videoId: string }>;
};

export default async function AdminSiteVideoEditPage({ params }: AdminSiteVideoEditPageProps) {
  const { videoId } = await params;
  const session = await requireSiteWebAdminPage(`/admin/sito-web/video/${videoId}/modifica`);

  const video = await prisma.siteVideo.findUnique({ where: { id: videoId } });
  if (!video) {
    redirect("/admin/sito-web/video");
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <AreaHeader
          title="Modifica video (Admin)"
          subtitle="Aggiorna i dati del video"
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
          mode="edit"
          videoId={video.id}
          initialValues={{
            title: video.title,
            youtubeUrl: video.youtubeUrl,
            description: video.description ?? "",
            isVisible: video.isVisible,
          }}
        />

        <div className="rounded-xl border border-red-200 bg-white p-4">
          <DeleteButton
            endpoint={`/api/admin/site/videos/${video.id}`}
            confirmMessage={`Eliminare il video "${video.title}"?`}
            successMessage="Video eliminato."
          />
        </div>
      </div>
    </main>
  );
}
