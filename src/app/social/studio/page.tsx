import { redirect } from "next/navigation";
import { StudioArchive } from "@/components/social-studio/studio-archive";
import { getAuthSession } from "@/lib/auth";
import { canUseSocialStudio } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { listSocialGraphics } from "@/lib/social-studio/queries";

export default async function SocialStudioArchivePage() {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/social/studio");
  }
  if (!canUseSocialStudio(session.user.role)) {
    redirect("/unauthorized");
  }

  const [items, categories] = await Promise.all([
    listSocialGraphics({}),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50">
      <StudioArchive
        initialItems={items}
        categories={categories}
        userName={session.user.name ?? "Social Studio"}
      />
    </main>
  );
}
