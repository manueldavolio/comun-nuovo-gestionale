import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-nav";
import { getAuthSession } from "@/lib/auth";

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await getAuthSession();

  return <AdminShell role={session?.user?.role}>{children}</AdminShell>;
}
