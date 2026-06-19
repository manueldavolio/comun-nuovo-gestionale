import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { DeleteButton } from "@/components/common/delete-button";
import { SiteAlbumForm } from "@/components/site-web/site-album-form";
import { SiteAlbumImagesManager } from "@/components/site-web/site-album-images-manager";
import { prisma } from "@/lib/prisma";
import { requireSiteWebAdminPage } from "@/lib/site-cms-server";

type AdminSiteAlbumEditPageProps = {
  params: Promise<{ albumId: string }>;
};

export default async function AdminSiteAlbumEditPage({ params }: AdminSiteAlbumEditPageProps) {
  const { albumId } = await params;
  const session = await requireSiteWebAdminPage(`/admin/sito-web/galleria/${albumId}/modifica`);

  const album = await prisma.siteGalleryAlbum.findUnique({
    where: { id: albumId },
    include: {
      images: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, imageUrl: true, alt: true },
      },
    },
  });
  if (!album) {
    redirect("/admin/sito-web/galleria");
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <AreaHeader
          title="Modifica album (Admin)"
          subtitle="Dati album e gestione foto"
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
          mode="edit"
          albumId={album.id}
          initialValues={{
            title: album.title,
            date: album.date ? album.date.toISOString().slice(0, 10) : "",
            isVisible: album.isVisible,
          }}
        />

        <SiteAlbumImagesManager albumId={album.id} images={album.images} />

        <div className="rounded-xl border border-red-200 bg-white p-4">
          <DeleteButton
            endpoint={`/api/admin/site/gallery/${album.id}`}
            confirmMessage={`Eliminare l'album "${album.title}" e tutte le sue foto?`}
            successMessage="Album eliminato."
          />
        </div>
      </div>
    </main>
  );
}
