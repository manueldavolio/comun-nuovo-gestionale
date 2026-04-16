import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { ROLE_HOME_PATH, canAccessPath } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";

const AUTH_DEBUG_PREFIX = "[AUTH_DEBUG]";
const PROTECTED_PATHS = ["/admin", "/genitore", "/mister"];
const VALID_ROLES: UserRole[] = ["ADMIN", "PARENT", "COACH", "YOUTH_DIRECTOR"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const tokenRole = typeof token?.role === "string" ? token.role.toUpperCase() : undefined;
  const role = VALID_ROLES.find((candidate) => candidate === tokenRole);
  const isLoggedIn = Boolean(token && role);

  console.info(`${AUTH_DEBUG_PREFIX} middleware: incoming`, {
    pathname,
    hasToken: Boolean(token),
    tokenSub: token?.sub,
    tokenRole: token?.role,
    resolvedRole: role,
    isLoggedIn,
  });

  if ((pathname === "/login" || pathname === "/register") && isLoggedIn && role) {
    console.info(`${AUTH_DEBUG_PREFIX} middleware: logged user blocked from auth pages`, {
      pathname,
      redirectTo: ROLE_HOME_PATH[role],
    });
    return NextResponse.redirect(new URL(ROLE_HOME_PATH[role], request.url));
  }

  if (!isProtectedPath(pathname)) {
    console.info(`${AUTH_DEBUG_PREFIX} middleware: public path, next`, { pathname });
    return NextResponse.next();
  }

  if (!isLoggedIn || !role) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    console.info(`${AUTH_DEBUG_PREFIX} middleware: no session, redirect login`, {
      pathname,
      redirectTo: loginUrl.toString(),
    });
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccessPath(role, pathname)) {
    console.info(`${AUTH_DEBUG_PREFIX} middleware: role forbidden`, {
      pathname,
      role,
      redirectTo: "/unauthorized",
    });
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  console.info(`${AUTH_DEBUG_PREFIX} middleware: access granted`, {
    pathname,
    role,
  });
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/genitore/:path*", "/mister/:path*", "/login", "/register"],
};
