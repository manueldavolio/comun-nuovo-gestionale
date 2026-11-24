import type { ReactNode } from "react";
import { getAuthSession } from "@/lib/auth";
import { requireAreaRole } from "@/lib/require-area-role";

type SocialLayoutProps = {
  children: ReactNode;
};

export default async function SocialLayout({ children }: SocialLayoutProps) {
  const session = await getAuthSession();
  requireAreaRole(
    session?.user?.role,
    ["ADMIN", "SOCIAL_MEDIA_MANAGER"],
    "/social/calendario",
  );
  return children;
}
