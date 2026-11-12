import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC = ["/signin", "/signup", "/verify-email", "/forgot-password", "/reset-password", "/accept-invite", "/logout", "/auth/logout"];
const GUEST_ONLY = ["/signin", "/signup"];

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path === p || path.startsWith(p + "/"));

  if (!token && !isPublic) return NextResponse.redirect(new URL("/signin", request.url));
  if (token && GUEST_ONLY.some((p) => path.startsWith(p)) && !request.nextUrl.searchParams.has("expired")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|images|favicon.ico|.*\\..*).*)"],
};
