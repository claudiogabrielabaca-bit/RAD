import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_COOKIE_NAME = "rad_admin_session";

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const protectedPaths = [
  "/rad-control-room",
  "/api/admin/reports",
  "/api/admin/report-resolve",
  "/api/admin/delete-review",
];

  const isProtected = protectedPaths.some((path) =>
    pathname.startsWith(path)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const adminSession = req.cookies.get(ADMIN_COOKIE_NAME)?.value;

  if (!adminSession) {
    return NextResponse.rewrite(new URL("/404", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/rad-control-room/:path*", "/api/admin/:path*"],
};