import { NextResponse } from "next/server";

/** Visiting /api/auth/logout in the browser signs out locally (clears the token cookie). */
function signOut(request: Request) {
  const res = NextResponse.redirect(new URL("/signin", request.url));
  res.cookies.set("token", "", { path: "/", expires: new Date(0) });
  return res;
}

export function GET(request: Request) {
  return signOut(request);
}

export function POST(request: Request) {
  return signOut(request);
}
