import { cookies } from "next/headers";

const ADMIN_COOKIE_NAME = "rad_admin_session";

export function getAdminCookieName() {
  return ADMIN_COOKIE_NAME;
}

export function getExpectedAdminUsername() {
  return process.env.ADMIN_USERNAME ?? "";
}

export function getExpectedAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? "";
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  const expectedUser = getExpectedAdminUsername();
  const expectedPass = getExpectedAdminPassword();

  if (!expectedUser || !expectedPass) return false;

  const expectedValue = `${expectedUser}:${expectedPass}`;
  return session === expectedValue;
}