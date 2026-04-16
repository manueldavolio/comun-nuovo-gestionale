import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { MediaItemForm } from "@/components/media/media-item-form";
import { MediaGallery } from "@/components/media/media-gallery";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { getCoachCategoryIdsForUser } from "@/lib/attendance";

export default async function CoachMediaPage() {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/mister/media");
  }

  if (session.user.role !== "COACH") {
    redirect("/unauthorized");
  }

  const coachCategoryIds = await getCoachCategoryIdsForUser(session.user.id);
  const now = new Date();

  const [categories, mediaItems] = await Promise.all([
    coachCategoryIds.length === 0
      ? Promise.resolve([])
      : prisma.category.findMany({
          where: { id: { in: coachCategoryIds } },
          orderBy: [{ name: "asc" }],
          select: { id: true, name: true },
        }),
    coachCategoryIds.length === 0
      ? Promise.resolve([])
      : prisma.mediaItem.findMany({
          where: {
            categoryId: {
              in: coachCategoryIds,
            },
            publishedAt: {
              not: null,
              lte: now,
            },
          },
          orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
          take: 80,
          select: {
            id: true,
            title: true,
            description: true,
            mediaType: true,
            mediaUrl: true,
            filePath: true,
            publishedAt: true,
            category: { select: { name: true } },
            createdBy: { select: { name: true } },
          },
        }),
  ]);

  const galleryItems = mediaItems.map((item) => ({
    ...item,
    categoryName: item.category.name,
    createdByName: item.createdBy.name,
  }));

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <AreaHeader
          title="Media categoria (Mister)"
          subtitle="Pubblica e consulta solo le categorie assegnate"
          userName={session.user.name ?? "Mister"}
        />

        <div className="flex flex-wrap gap-2">
          <Link
            href="/mister"
            className="inline-flex items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Torna dashboard mister
          </Link>
        </div>

        {categories.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
            Nessuna categoria assegnata al tuo profilo.
          </p>
        ) : (
          <MediaItemForm categories={categories} title="Nuovo media categoria (Mister)" />
        )}

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Galleria categorie assegnate</h2>
          <div className="mt-4">
            <MediaGallery items={galleryItems} emptyMessage="Nessun media disponibile per le tue categorie." />
          </div>
        </section>
      </div>
    </main>
  );
}
