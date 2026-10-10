import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/**
 * Coarse gate only: redirects anonymous visitors away from app routes.
 * Real authorisation (roles, event ownership, judge privacy) is enforced in
 * server components, server actions and API routes.
 */
const PROTECTED = ["/dashboard", "/events", "/my", "/judge", "/settings", "/audit", "/explore"];
const PUBLIC_AUTH = new Set(["/forgot-password", "/reset-password", "/verify-email"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_AUTH.has(pathname)) return NextResponse.next();
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !session) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
