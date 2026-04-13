import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/app/lib/admin";

const protectedPaths = ["/rad-control-room"];

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const isProtected = protectedPaths.some((path) =>
    pathname.startsWith(path)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const adminSession = req.cookies.get(ADMIN_COOKIE_NAME)?.value ?? "";

  if (!adminSession) {
    return NextResponse.redirect(new URL("/rad-admin-login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/rad-control-room/:path*"],
};