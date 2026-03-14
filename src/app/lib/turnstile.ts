export type TurnstileVerifyResult = {
  ok: boolean;
  errors?: string[];
};

function getClientIp(req?: Request) {
  if (!req) return undefined;

  const forwardedFor =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip");

  if (!forwardedFor) return undefined;

  return forwardedFor.split(",")[0]?.trim() || undefined;
}

export async function verifyTurnstileToken(
  token: string,
  req?: Request
): Promise<TurnstileVerifyResult> {
  const isNonProduction = process.env.NODE_ENV !== "production";

  if (isNonProduction && token === "local-dev-bypass") {
    return {
      ok: true,
    };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    console.error("Missing TURNSTILE_SECRET_KEY");
    return {
      ok: false,
      errors: ["missing-secret"],
    };
  }

  if (!token || !token.trim()) {
    return {
      ok: false,
      errors: ["missing-input-response"],
    };
  }

  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token.trim());

    const ip = getClientIp(req);
    if (ip) {
      body.set("remoteip", ip);
    }

    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        cache: "no-store",
      }
    );

    const json = (await res.json().catch(() => null)) as
      | {
          success?: boolean;
          ["error-codes"]?: string[];
        }
      | null;

    if (!res.ok || !json?.success) {
      return {
        ok: false,
        errors: json?.["error-codes"] ?? ["turnstile-verification-failed"],
      };
    }

    return {
      ok: true,
    };
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return {
      ok: false,
      errors: ["turnstile-request-failed"],
    };
  }
}