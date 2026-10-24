import { notFound, redirect } from "next/navigation";
import { StudioEditor } from "@/components/social-studio/studio-editor";
import { getAuthSession } from "@/lib/auth";
import { canUseSocialStudio } from "@/lib/permissions";
import { getSocialGraphic, listSocialAssets } from "@/lib/social-studio/queries";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SocialStudioEditorPage({ params }: PageProps) {
  const session = await getAuthSession();
  const { id } = await params;
  if (!session?.user) {
    redirect(`/login?callbackUrl=/social/studio/${id}`);
  }
  if (!canUseSocialStudio(session.user.role)) {
    redirect("/unauthorized");
  }

  const [graphic, assets] = await Promise.all([
    getSocialGraphic(id),
    listSocialAssets(),
  ]);
  if (!graphic) notFound();

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50">
      <StudioEditor initialGraphic={graphic} assets={assets} />
    </main>
  );
}
