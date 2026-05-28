export const AUTH_JSON_HEADERS = {
  "Content-Type": "application/json",
};

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function readAuthJson<T extends Record<string, unknown>>(
  response: Response
): Promise<T | null> {
  const json: unknown = await response.json().catch(() => null);

  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return null;
  }

  return json as T;
}
