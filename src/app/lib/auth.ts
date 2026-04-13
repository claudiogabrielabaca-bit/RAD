import { prisma } from "@/app/lib/prisma";
import { cookies } from "next/headers";
import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "crypto";
import bcrypt from "bcryptjs";
import { claimVisitorDeckToUser } from "@/app/lib/surprise-deck";

const SESSION_COOKIE = "rad_session";
const SESSION_DAYS = 30;
const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;
const BCRYPT_ROUNDS = 12;

type AuthCodePurpose = "verify" | "login" | "reset";

function getAuthCodeSecret() {
  const secret = process.env.AUTH_CODE_SECRET?.trim();

  if (!secret) {
    throw new Error("Missing AUTH_CODE_SECRET");
  }

  return secret;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function generateSessionToken() {
  return randomBytes(32).toString("hex");
}

export function generateNumericCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += randomInt(0, 10).toString();
  }
  return code;
}

export function hashAuthCode({
  email,
  code,
  purpose,
}: {
  email: string;
  code: string;
  purpose: AuthCodePurpose;
}) {
  const secret = getAuthCodeSecret();

  return createHmac("sha256", secret)
    .update(`${purpose}:${normalizeEmail(email)}:${code}`)
    .digest("hex");
}

export function verifyAuthCode({
  email,
  code,
  purpose,
  hash,
}: {
  email: string;
  code: string;
  purpose: AuthCodePurpose;
  hash: string | null | undefined;
}) {
  if (!hash) return false;

  const expected = hashAuthCode({
    email,
    code,
    purpose,
  });

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(hash, "utf8");

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

export async function createSession(userId: string) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  const store = await cookies();

  store.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_MAX_AGE,
    priority: "high",
  });

  await claimVisitorDeckToUser(userId).catch((error) => {
    console.error("claimVisitorDeckToUser error:", error);
  });

  return token;
}

export async function clearSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session.deleteMany({
      where: { token },
    });
  }

  store.set({
    name: SESSION_COOKIE,
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

export async function getSessionToken() {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}