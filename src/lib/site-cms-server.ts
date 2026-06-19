import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugifyNewsTitle } from "@/lib/site-cms";

/** Guard pagine admin "Sito web": solo ruolo ADMIN. */
export async function requireSiteWebAdminPage(callbackPath: string): Promise<Session> {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${callbackPath}`);
  }
  if (session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }
  return session;
}

/** Guard API admin "Sito web": solo ruolo ADMIN. */
export async function requireSiteWebAdminApi(): Promise<
  { session: Session; errorResponse: null } | { session: null; errorResponse: NextResponse }
> {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return {
      session: null,
      errorResponse: NextResponse.json({ error: "Sessione non valida." }, { status: 401 }),
    };
  }
  if (session.user.role !== "ADMIN") {
    return {
      session: null,
      errorResponse: NextResponse.json({ error: "Operazione non consentita." }, { status: 403 }),
    };
  }
  return { session, errorResponse: null };
}

/** Genera uno slug univoco per una news, aggiungendo un suffisso numerico se necessario. */
export async function buildUniqueNewsSlug(title: string, excludeId?: string): Promise<string> {
  const baseSlug = slugifyNewsTitle(title);
  let candidate = baseSlug;
  let suffix = 2;

  for (;;) {
    const existing = await prisma.siteNews.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) {
      return candidate;
    }
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}
