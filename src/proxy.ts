import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/app/lib/admin";

const protectedPaths = ["/rad-control-room"];

function isLikelyAdminSessionToken(value: string) {
  return /^[a-f0-9]{64}$/i.test(value);
}

function redirectToAdminLogin(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/rad-admin-login", req.url));

  res.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
    priority: "high",
  });

  return res;
}

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const isProtected = protectedPaths.some((path) =>
    pathname.startsWith(path)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const adminSession = req.cookies.get(ADMIN_COOKIE_NAME)?.value ?? "";

  if (!adminSession || !isLikelyAdminSessionToken(adminSession)) {
    return redirectToAdminLogin(req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/rad-control-room/:path*"],
};
