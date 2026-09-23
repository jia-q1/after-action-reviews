import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Redirects unauthenticated visits to the internal drafting tool over to
// /login. This is the UX layer only -- every mutating API route also
// checks requireAuth() independently (see src/lib/auth.ts), since a
// matcher gap or a route added later without updating this file would
// otherwise silently lose protection. The public Review Library (/) and
// individual completed-review pages are deliberately not matched here.
export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (verifySessionToken(token)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/workspace/:path*", "/new", "/new/:path*", "/reviews/:slug/edit"],
};
