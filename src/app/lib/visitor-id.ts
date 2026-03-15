import { cookies } from "next/headers";
import { randomBytes } from "crypto";

const VISITOR_COOKIE = "rad_visitor";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365 * 5; // 5 años

export async function getVisitorId() {
  const store = await cookies();
  return store.get(VISITOR_COOKIE)?.value ?? null;
}

export async function getOrCreateVisitorId() {
  const store = await cookies();
  const existing = store.get(VISITOR_COOKIE)?.value;

  if (existing) {
    return existing;
  }

  const visitorId = randomBytes(16).toString("hex");

  store.set({
    name: VISITOR_COOKIE,
    value: visitorId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VISITOR_MAX_AGE,
    priority: "high",
  });

  return visitorId;
}