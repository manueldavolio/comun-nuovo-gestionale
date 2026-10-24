import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { decideSocialStudioAccess } from "@/lib/social-studio/access";
import { listStudioMatches } from "@/lib/social-studio/queries";

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
  try {
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
