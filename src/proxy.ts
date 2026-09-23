import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// The whole app -- the public Review Library included -- requires the
// shared access code now, except: the login page itself (or you'd get a
// redirect loop), and the survey response flow (/respond/[id] and its
// submit API), since those are for external invitees who were never
// meant to need an internal UNDP login. This is the UX layer only --
// every mutating/PII API route also checks requireAuth() independently
// (see src/lib/auth.ts), since a matcher gap or a route added later
// without updating this file would otherwise silently lose protection.
export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (verifySessionToken(token)) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  // API requests get a plain 401, not a redirect to an HTML login page.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Excludes: /login, /respond/*, /api/login, /api/logout, /api/respond/*,
    // and standard static/metadata paths.
    "/((?!login|respond|api/login|api/logout|api/respond|_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt).*)",
  ],
};
