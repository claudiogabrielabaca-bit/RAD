import { prisma } from "@/app/lib/prisma";
import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import type { NextResponse } from "next/server";

export const ADMIN_COOKIE_NAME = "rad_admin_session";

const ADMIN_SESSION_DAYS = 7;
const ADMIN_SESSION_MAX_AGE = ADMIN_SESSION_DAYS * 24 * 60 * 60;

function normalizeAdminUsername(value: string) {
  return value.trim().toLowerCase();
}

function getAdminSessionSecret() {
  const secret =
    process.env.ADMIN_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    "";

  if (!secret) {
    throw new Error("Missing ADMIN_SECRET or SESSION_SECRET");
  }

  return secret;
}

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");

  if (aBuf.length !== bBuf.length) {
    return false;
  }

  return timingSafeEqual(aBuf, bBuf);
}

function isBcryptHash(value: string) {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

async function compareAdminPassword(input: string, expected: string) {
  if (isBcryptHash(expected)) {
    return bcrypt.compare(input, expected);
  }

  return safeEqual(input, expected);
}

async function readIncomingAdminSessionToken() {
  const store = await cookies();
  return store.get(ADMIN_COOKIE_NAME)?.value ?? "";
}

function getAdminCookieValueOptions(expiresAt?: Date | null) {
  return {
    httpOnly: true as const,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires:
      expiresAt ?? new Date(Date.now() + ADMIN_SESSION_MAX_AGE * 1000),
    maxAge: ADMIN_SESSION_MAX_AGE,
    priority: "high" as const,
  };
}

function getExpiredAdminCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
    priority: "high" as const,
  };
}

async function createAdminSessionRecord(username: string) {
  const normalizedUsername = normalizeAdminUsername(username);
  const token = generateAdminSessionToken();
  const tokenHash = hashAdminSessionToken(token);
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_MAX_AGE * 1000);

  await prisma.adminSession.deleteMany({
    where: {
      OR: [
        {
          expiresAt: {
            lt: new Date(),
          },
        },
        {
          username: normalizedUsername,
        },
      ],
    },
  });

  await prisma.adminSession.create({
    data: {
      username: normalizedUsername,
      tokenHash,
      expiresAt,
    },
  });

  return {
    token,
    expiresAt,
  };
}

export function generateAdminSessionToken() {
  return randomBytes(32).toString("hex");
}

export function hashAdminSessionToken(token: string) {
  return createHmac("sha256", getAdminSessionSecret())
    .update(token)
    .digest("hex");
}

export async function verifyAdminCredentials(
  input:
    | {
        username: string;
        password: string;
      }
    | string,
  maybePassword?: string
) {
  const expectedUsername = process.env.ADMIN_USERNAME?.trim() ?? "";
  const expectedPassword = process.env.ADMIN_PASSWORD?.trim() ?? "";

  if (!expectedUsername || !expectedPassword) {
    return false;
  }

  const username =
    typeof input === "string" ? input : (input?.username ?? "");
  const password =
    typeof input === "string" ? (maybePassword ?? "") : (input?.password ?? "");

  const normalizedInputUsername = normalizeAdminUsername(username);
  const normalizedExpectedUsername = normalizeAdminUsername(expectedUsername);

  if (!safeEqual(normalizedInputUsername, normalizedExpectedUsername)) {
    return false;
  }

  return compareAdminPassword(password, expectedPassword);
}

export async function setAdminSessionCookie(
  input: string | NextResponse<unknown>,
  expiresAt?: Date | null
) {
  if (typeof input !== "string") {
    const expectedUsername = process.env.ADMIN_USERNAME?.trim() ?? "";

    if (!expectedUsername) {
      throw new Error("Missing ADMIN_USERNAME");
    }

    const session = await createAdminSessionRecord(expectedUsername);

    input.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: session.token,
      ...getAdminCookieValueOptions(session.expiresAt),
    });

    return session.token;
  }

  const store = await cookies();

  store.set({
    name: ADMIN_COOKIE_NAME,
    value: input,
    ...getAdminCookieValueOptions(expiresAt),
  });

  return input;
}

export async function clearAdminSessionCookie(
  res?: NextResponse<unknown>
) {
  if (res) {
    res.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: "",
      ...getExpiredAdminCookieOptions(),
    });
    return;
  }

  const store = await cookies();

  store.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    ...getExpiredAdminCookieOptions(),
  });
}

export async function createAdminSession(username: string) {
  const session = await createAdminSessionRecord(username);
  await setAdminSessionCookie(session.token, session.expiresAt);
  return session.token;
}

export async function clearAdminSession() {
  const token = await readIncomingAdminSessionToken();

  if (token) {
    const tokenHash = hashAdminSessionToken(token);

    await prisma.adminSession.deleteMany({
      where: { tokenHash },
    });
  }

  await clearAdminSessionCookie();
}

export async function getAdminSession() {
  const token = await readIncomingAdminSessionToken();

  if (!token) return null;

  const tokenHash = hashAdminSessionToken(token);

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      username: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt < new Date()) {
    await prisma.adminSession
      .delete({
        where: { id: session.id },
      })
      .catch(() => {});

    await clearAdminSessionCookie();

    return null;
  }

  return session;
}

export async function requireAdminSession() {
  return getAdminSession();
}

export async function isAdminAuthenticated() {
  return !!(await getAdminSession());
}

export function verifyAdminSessionValue(value: string | null | undefined) {
  const expected = process.env.ADMIN_SECRET?.trim();

  if (!expected || !value) {
    return false;
  }

  return safeEqual(value, expected);
}