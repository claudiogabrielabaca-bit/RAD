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

export function getAuthViewContent(view: string) {
  switch (view) {
    case "login":
      return {
        title: "Log in",
        subtitle: "Enter your email and password to access your account.",
      };
    case "login-code":
      return {
        title: "Enter login code",
        subtitle: "Enter the access code sent to your email.",
      };
    case "register":
      return {
        title: "Create account",
        subtitle: "Create your RAD account and start saving ratings and favorites.",
      };
    case "forgot-password":
      return {
        title: "Forgot password",
        subtitle: "Enter your email and request a recovery code.",
      };
    case "reset-password":
      return {
        title: "Reset password",
        subtitle: "Use your recovery code and choose a new password.",
      };
    case "verify-email":
      return {
        title: "Verify your email",
        subtitle: "Confirm that this email belongs to you.",
      };
    default:
      return {
        title: "Account",
        subtitle: "",
      };
  }
}
