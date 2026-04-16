import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // TEST TEMPORANEO: middleware bypass per debug login online
  void request;
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/genitore/:path*", "/mister/:path*", "/login", "/register"],
};
