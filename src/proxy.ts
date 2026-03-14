import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";

const ADMIN_COOKIE_NAME = "rad_admin_session";

const protectedPaths = [
  "/rad-control-room",
  "/api/admin/reports",
  "/api/admin/report-resolve",
  "/api/admin/delete-review",
];

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const isProtected = protectedPaths.some((path) =>
    pathname.startsWith(path)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const adminSecret = process.env.ADMIN_SECRET;
  const adminSession = req.cookies.get(ADMIN_COOKIE_NAME)?.value ?? "";

  if (!adminSecret || !adminSession || !safeEqual(adminSession, adminSecret)) {
    return NextResponse.rewrite(new URL("/404", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/rad-control-room/:path*", "/api/admin/:path*"],
};