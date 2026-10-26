import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { decideSocialStudioAccess } from "@/lib/social-studio/access";
import { listStudioMatches, listWeekendStudioMatches } from "@/lib/social-studio/queries";
import type { WeekendSector } from "@/lib/social-studio/weekend-sectors";

export async function GET(request: Request) {
  const session = await getAuthSession();
  const access = decideSocialStudioAccess({
    authenticated: Boolean(session?.user?.id),
    role: session?.user?.role,
  });
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Sessione non valida." : "Operazione non consentita." },
      { status: access.status },
    );
  }

  const { searchParams } = new URL(request.url);
  const sectorRaw = (searchParams.get("sector") ?? "").trim().toUpperCase();
  try {
    if (sectorRaw === "BASE" || sectorRaw === "AGONISTICO") {
      const data = await listWeekendStudioMatches({
        sector: sectorRaw as WeekendSector,
        from: searchParams.get("from"),
        to: searchParams.get("to"),
      });
      return NextResponse.json({ success: true, data });
    }

    const data = await listStudioMatches({
      month: searchParams.get("month"),
      categoryId: searchParams.get("categoryId"),
      q: searchParams.get("q"),
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[social studio matches]", error);
    return NextResponse.json({ error: "Impossibile caricare le partite." }, { status: 500 });
  }
}
