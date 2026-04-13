import { prisma } from "@/app/lib/prisma";
import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export const ADMIN_COOKIE_NAME = "rad_admin_session";
const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12;

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

function normalizeAdminUsername(value: string) {
  return value.trim().toLowerCase();
}

function getRequiredEnv(
  name: "ADMIN_USERNAME" | "ADMIN_PASSWORD_HASH" | "ADMIN_SECRET"
) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

function getAdminUsername() {
  return normalizeAdminUsername(getRequiredEnv("ADMIN_USERNAME"));
}

function getAdminPasswordHash() {
  return getRequiredEnv("ADMIN_PASSWORD_HASH");
}

function getAdminSessionSecret() {
  return getRequiredEnv("ADMIN_SECRET");
}

function hashAdminSessionToken(token: string) {
  return createHmac("sha256", getAdminSessionSecret())
    .update(token)
    .digest("hex");
}

async function readIncomingAdminToken() {
  const store = await cookies();
  return store.get(ADMIN_COOKIE_NAME)?.value ?? "";
}

export async function verifyAdminCredentials({
  username,
  password,
}: {
  username: string;
  password: string;
}) {
  const normalizedUsername = normalizeAdminUsername(username);
  const expectedUsername = getAdminUsername();
  const passwordHash = getAdminPasswordHash();

  const validUsername = safeEqual(normalizedUsername, expectedUsername);
  const validPassword = await bcrypt.compare(password, passwordHash).catch(() => false);

  return validUsername && validPassword;
}

async function createAdminSessionRecord() {
  await prisma.adminSession.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashAdminSessionToken(token);
  const expiresAt = new Date(Date.now() + ADMIN_COOKIE_MAX_AGE * 1000);

  await prisma.adminSession.create({
    data: {
      username: getAdminUsername(),
      tokenHash,
      expiresAt,
    },
  });

  return {
    token,
    expiresAt,
  };
}

export async function isAdminAuthenticated() {
  const token = await readIncomingAdminToken();

  if (!token) {
    return false;
  }

  const tokenHash = hashAdminSessionToken(token);

  const session = await prisma.adminSession.findUnique({
    where: {
      tokenHash,
    },
  });

  if (!session) {
    return false;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.adminSession.deleteMany({
      where: {
        tokenHash,
      },
    }).catch(() => {});

    return false;
  }

  return true;
}

export async function setAdminSessionCookie(res: NextResponse) {
  const { token, expiresAt } = await createAdminSessionRecord();

  res.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
    maxAge: ADMIN_COOKIE_MAX_AGE,
    priority: "high",
  });
}

export async function clearAdminSessionCookie(res: NextResponse) {
  const token = await readIncomingAdminToken();

  if (token) {
    const tokenHash = hashAdminSessionToken(token);

    await prisma.adminSession.deleteMany({
      where: {
        tokenHash,
      },
    }).catch(() => {});
  }

  res.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
    priority: "high",
  });
}