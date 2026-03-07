import { cookies } from "next/headers";

export async function getOrCreateAnonId() {
  const store = await cookies();

  let anonId = store.get("anonId")?.value;

  if (!anonId) {
    anonId =
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    store.set({
      name: "anonId",
      value: anonId,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return anonId;
}