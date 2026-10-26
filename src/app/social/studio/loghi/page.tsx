import { redirect } from "next/navigation";
import { StudioLogosArchive } from "@/components/social-studio/studio-logos-archive";
import { getAuthSession } from "@/lib/auth";
import { canUseSocialStudio } from "@/lib/permissions";
import { listSocialAssets } from "@/lib/social-studio/queries";

export default async function SocialStudioLogosPage() {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/social/studio/loghi");
  }
  if (!canUseSocialStudio(session.user.role)) {
    redirect("/unauthorized");
  }

  const assets = await listSocialAssets("OPPONENT_LOGO");

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50">
      <StudioLogosArchive
        initialAssets={assets}
        userName={session.user.name ?? "Social Studio"}
      />
    </main>
  );
}
