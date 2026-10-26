import { redirect } from "next/navigation";
import { MediaGallery } from "@/components/media/media-gallery";
import { ParentAreaHeader } from "@/components/parent-dashboard/parent-area-header";
import { getAuthSession } from "@/lib/auth";
import { athletesAssociatedToParentWhere } from "@/lib/parent-athletes";
import { prisma } from "@/lib/prisma";

export default async function ParentMediaPage() {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/genitore/media");
  }

  if (session.user.role !== "PARENT") {
    redirect("/unauthorized");
  }

  const parentProfile = await prisma.parentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!parentProfile) {
    redirect("/unauthorized");
  }

  const athletes = await prisma.athlete.findMany({
    where: athletesAssociatedToParentWhere(parentProfile.id),
    select: { categoryId: true },
  });

  const categoryIds = Array.from(new Set(athletes.map((athlete) => athlete.categoryId)));
  const now = new Date();

  const mediaItems =
    categoryIds.length === 0
      ? []
      : await prisma.mediaItem.findMany({
          where: {
            categoryId: {
              in: categoryIds,
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
        });

  const galleryItems = mediaItems.map((item) => ({
    ...item,
    categoryName: item.category.name,
    createdByName: item.createdBy.name,
  }));

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-100 via-slate-50 to-blue-100/60 p-4 pb-10 md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <ParentAreaHeader
          title="Foto e video"
          subtitle="Galleria delle categorie dei tuoi figli"
          userName={session.user.name ?? "Genitore"}
          backHref="/genitore"
        />

        <section className="rounded-3xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-black text-zinc-900">Galleria categoria</h2>
          <div className="mt-4">
            <MediaGallery
              items={galleryItems}
              emptyMessage="Nessun media disponibile per le categorie dei tuoi figli."
            />
          </div>
        </section>
      </div>
    </main>
  );
}
