import type { ReactNode } from "react";
import { getAuthSession } from "@/lib/auth";
import { requireAreaRole } from "@/lib/require-area-role";

type GenitoreLayoutProps = {
  children: ReactNode;
};

export default async function GenitoreLayout({ children }: GenitoreLayoutProps) {
  const session = await getAuthSession();
  requireAreaRole(session?.user?.role, ["PARENT"], "/genitore");
  return children;
}
