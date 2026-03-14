import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  verifyAdminSessionValue,
} from "@/app/lib/admin";

const protectedPaths = [
  "/rad-control-room",
  "/api/admin/reports",
  "/api/admin/report-resolve",
  "/api/admin/delete-review",
  "/api/admin/recent-reviews",
  "/api/admin/stats",
];

const publicAdminPaths = ["/api/admin/login", "/api/admin/logout"];

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const isPublicAdminPath = publicAdminPaths.some((path) =>
    pathname.startsWith(path)
  );

  if (isPublicAdminPath) {
    return NextResponse.next();
  }

  const isProtected = protectedPaths.some((path) =>
    pathname.startsWith(path)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const adminSession = req.cookies.get(ADMIN_COOKIE_NAME)?.value ?? "";
  const isValid = verifyAdminSessionValue(adminSession);

  if (!isValid) {
    if (pathname.startsWith("/api/admin/")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.redirect(new URL("/rad-admin", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/rad-control-room/:path*", "/api/admin/:path*"],
};
