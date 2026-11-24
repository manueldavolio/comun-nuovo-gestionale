import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-nav";
import { getAuthSession } from "@/lib/auth";
import { requireAreaRole } from "@/lib/require-area-role";

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await getAuthSession();
  requireAreaRole(session?.user?.role, ["ADMIN", "YOUTH_DIRECTOR"], "/admin");

  return <AdminShell role={session?.user?.role}>{children}</AdminShell>;
}
