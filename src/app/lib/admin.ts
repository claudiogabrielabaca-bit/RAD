import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

export const ADMIN_COOKIE_NAME = "rad_admin_session";
const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12;

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

function getAdminSecret() {
  return process.env.ADMIN_SECRET ?? "";
}

function createAdminSessionValue(secret: string) {
  return createHmac("sha256", secret)
    .update("rad-admin-session")
    .digest("hex");
}

export function verifyAdminSessionValue(sessionValue: string) {
  const secret = getAdminSecret();

  if (!secret || !sessionValue) {
    return false;
  }

  const expected = createAdminSessionValue(secret);
  return safeEqual(sessionValue, expected);
}

export async function isAdminAuthenticated() {
  const secret = getAdminSecret();

  if (!secret) {
    return false;
  }

  const store = await cookies();
  const sessionValue = store.get(ADMIN_COOKIE_NAME)?.value ?? "";

  return verifyAdminSessionValue(sessionValue);
}

export function setAdminSessionCookie(res: NextResponse) {
  const secret = getAdminSecret();

  if (!secret) {
    throw new Error("Missing ADMIN_SECRET");
  }

  const value = createAdminSessionValue(secret);

  res.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });
}

export function clearAdminSessionCookie(res: NextResponse) {
  res.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}
