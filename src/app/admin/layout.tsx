import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { getAuthSession } from "@/lib/auth";

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await getAuthSession();

  return (
    <>
      <AdminNav role={session?.user?.role} />
      {children}
    </>
  );
}
