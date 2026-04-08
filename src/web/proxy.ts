import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const session = req.cookies.get("alook_session");
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protect all (app) group routes but not /login, /api, or static assets
    "/((?!login|auth|health|api|_next|favicon\\.ico|.*\\.).*)",
  ],
};
