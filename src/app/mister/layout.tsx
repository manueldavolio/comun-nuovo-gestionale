import { MisterShell } from "@/components/mister/mister-nav";
import { getAuthSession } from "@/lib/auth";
import { requireAreaRole } from "@/lib/require-area-role";

export default async function MisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();
  // ADMIN resta ammesso per alcuni tool eventi condivisi; le pagine solo-COACH
  // usano requireAreaRole(["COACH"]) e mandano gli altri ruoli al sync.
  requireAreaRole(session?.user?.role, ["COACH", "ADMIN"], "/mister");
  return <MisterShell>{children}</MisterShell>;
}
