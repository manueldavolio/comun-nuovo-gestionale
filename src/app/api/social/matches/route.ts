import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { decideSocialMatchesAccess } from "@/lib/social-matches";
import { listSocialMatches } from "@/lib/social-matches-queries";

/**
 * Calendario partite sola lettura per SOCIAL_MEDIA_MANAGER.
 * Nessun dato atleta/staff/risultato/valutazione.
 */
export async function GET(request: Request) {
  const session = await getAuthSession();
  const access = decideSocialMatchesAccess({
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
  try {
    const data = await listSocialMatches({
      month: searchParams.get("month"),
      categoryId: searchParams.get("categoryId"),
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[social matches]", error);
    return NextResponse.json({ error: "Impossibile caricare il calendario." }, { status: 500 });
  }
}
