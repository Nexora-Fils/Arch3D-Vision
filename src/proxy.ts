import { NextResponse, type NextRequest } from "next/server";
import { loginPath } from "@/lib/auth/next-path";
import { SESSION_COOKIE } from "@/lib/auth/session-cookie";

/**
 * Optimistic check (cookie presence only) so private pages redirect before rendering.
 * The session itself is verified in the database by the pages, actions and API routes.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  return NextResponse.redirect(new URL(loginPath(`${pathname}${search}`), request.url));
}

export const config = {
  matcher: ["/dashboard", "/projects", "/projects/new", "/settings"],
};
