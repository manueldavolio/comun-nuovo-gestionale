import { redirect } from "next/navigation";
import { MediaGallery } from "@/components/media/media-gallery";
import { ImageConsentManager } from "@/components/parent/image-consent-manager";
import { PrivacyAcknowledgementPanel } from "@/components/parent/privacy-acknowledgement-panel";
import { ParentAreaHeader } from "@/components/parent-dashboard/parent-area-header";
import { getAuthSession } from "@/lib/auth";
import {
  parentVisibleMediaWhere,
  resolveAthleteImageConsentForPurpose,
} from "@/lib/image-consent";
import { resolveImageConsentRuntimeMode } from "@/lib/legal/image-consent-activation";
import { getCurrentLegalDocument } from "@/lib/legal/legal-documents";
import { getLatestPrivacyNoticeAcknowledgement } from "@/lib/legal/privacy-acknowledgement";
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

  const imageConsentMode = await resolveImageConsentRuntimeMode();

  const athletes = await prisma.athlete.findMany({
    where: athletesAssociatedToParentWhere(parentProfile.id),
    select: { id: true, firstName: true, lastName: true, categoryId: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const categoryIds = Array.from(new Set(athletes.map((athlete) => athlete.categoryId)));
  const consentRows = await Promise.all(
    athletes.map(async (athlete) => {
      const [internal, external] = await Promise.all([
        resolveAthleteImageConsentForPurpose(athlete.id, "INTERNAL"),
        resolveAthleteImageConsentForPurpose(athlete.id, "EXTERNAL"),
      ]);
      return {
        id: athlete.id,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        granted: external.granted,
        internal: {
          choice: internal.choice,
          granted: internal.granted,
          documentVersion: internal.documentVersion,
          recordedAt: internal.recordedAt,
          legacyHistoricalOnly: internal.legacyHistoricalOnly,
          source: internal.source,
        },
        external: {
          choice: external.choice,
          granted: external.granted,
          documentVersion: external.documentVersion,
          recordedAt: external.recordedAt,
          legacyHistoricalOnly: external.legacyHistoricalOnly,
          source: external.source,
        },
      };
    }),
  );

  const privacyDoc = await getCurrentLegalDocument("PRIVACY_NOTICE");
  const latestPrivacyAck = await getLatestPrivacyNoticeAcknowledgement(session.user.id);
  const acknowledgedCurrent =
    Boolean(privacyDoc) &&
    latestPrivacyAck?.documentVersion === privacyDoc?.version &&
    latestPrivacyAck?.documentContentSha256 === privacyDoc?.contentSha256;

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
          title="Privacy e foto"
          subtitle="Presa visione privacy, autorizzazioni immagini e galleria"
          userName={session.user.name ?? "Genitore"}
          backHref="/genitore"
        />

        {imageConsentMode === "dual_v1_1" ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Autorizzazioni immagini 1.1 attive: uso interno e pubblicazione esterna sono scelte
            separate. I consensi 1.0 non vengono convertiti automaticamente.
          </div>
        ) : (
          <div className="rounded-3xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
            È ancora attiva l&apos;autorizzazione immagini 1.0. Le due autorizzazioni separate 1.1
            restano disattivate fino all&apos;attivazione ufficiale.
          </div>
        )}

        <PrivacyAcknowledgementPanel
          acknowledgedCurrent={acknowledgedCurrent}
          currentVersion={privacyDoc?.version ?? null}
          latestAcknowledgedAt={latestPrivacyAck?.acknowledgedAt?.toISOString() ?? null}
        />

        <ImageConsentManager athletes={consentRows} mode={imageConsentMode} />

        <section className="rounded-3xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-black text-zinc-900">Galleria categoria</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Sono visibili solo i contenuti revisionati con autorizzazioni valide per ogni soggetto
            identificabile dichiarato. Una foto di squadra non è automaticamente autorizzata.
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
