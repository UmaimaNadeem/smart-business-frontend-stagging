import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;

  const isAuthPage =
    request.nextUrl.pathname.startsWith("/signin") ||
    request.nextUrl.pathname.startsWith("/signup");

  // 🚫 Not logged in → redirect to signin
  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL("/signin", request.url));
  }

  // 🚫 Logged in → block auth pages
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

// 🟢 Matcher — which routes middleware applies to
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|images|favicon.ico|.*\\..*).*)",
  ],
};