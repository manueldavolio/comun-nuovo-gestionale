import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { ROLE_HOME_PATH, canAccessPath } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/enums";

const PROTECTED_PATHS = ["/admin", "/genitore", "/mister"];
const VALID_ROLES: Role[] = ["ADMIN", "PARENT", "COACH", "YOUTH_DIRECTOR"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const tokenRole = token?.role;
  const role = VALID_ROLES.find((candidate) => candidate === tokenRole);
  const isLoggedIn = Boolean(token && role);

  if (pathname === "/login" && isLoggedIn && role) {
    return NextResponse.redirect(new URL(ROLE_HOME_PATH[role], request.url));
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (!isLoggedIn || !role) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccessPath(role, pathname)) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/genitore/:path*", "/mister/:path*", "/login"],
};
