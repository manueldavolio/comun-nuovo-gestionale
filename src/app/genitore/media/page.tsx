import { redirect } from "next/navigation";
import { MediaGallery } from "@/components/media/media-gallery";
import { ImageConsentManager } from "@/components/parent/image-consent-manager";
import { ParentAreaHeader } from "@/components/parent-dashboard/parent-area-header";
import { getAuthSession } from "@/lib/auth";
import { parentVisibleMediaWhere, resolveAthleteImageConsent } from "@/lib/image-consent";
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
    select: { id: true, firstName: true, lastName: true, categoryId: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const categoryIds = Array.from(new Set(athletes.map((athlete) => athlete.categoryId)));
  const consentRows = await Promise.all(
    athletes.map(async (athlete) => {
      const state = await resolveAthleteImageConsent(athlete.id);
      return {
        id: athlete.id,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        granted: state.granted,
      };
    }),
  );

  const mediaItems =
    categoryIds.length === 0
      ? []
      : await prisma.mediaItem.findMany({
          where: {
            categoryId: { in: categoryIds },
            ...parentVisibleMediaWhere(),
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
          subtitle="Galleria e autorizzazioni immagini dei tuoi figli"
          userName={session.user.name ?? "Genitore"}
          backHref="/genitore"
        />

        <ImageConsentManager athletes={consentRows} />

        <section className="rounded-3xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-black text-zinc-900">Galleria categoria</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Sono visibili solo i contenuti revisionati con autorizzazioni valide per i soggetti
            dichiarati.
          </p>
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
