import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { decideMiddlewareAuth } from "@/lib/middleware-auth";

const AUTH_DEBUG_PREFIX = "[AUTH_DEBUG]";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const decision = decideMiddlewareAuth({
    pathname,
    tokenRole: token?.role,
    hasToken: Boolean(token),
  });

  console.info(`${AUTH_DEBUG_PREFIX} middleware: decision`, {
    pathname,
    hasToken: Boolean(token),
    tokenRole: token?.role,
    decision,
  });

  if (decision.type === "redirect") {
    const target = decision.to.startsWith("http")
      ? decision.to
      : new URL(decision.to, request.url);
    return NextResponse.redirect(target);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/genitore/:path*",
    "/mister/:path*",
    "/social/:path*",
    "/login",
    "/register",
  ],
};
