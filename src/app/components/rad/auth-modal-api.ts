import {
  AUTH_JSON_HEADERS,
  readAuthJson,
} from "@/app/components/rad/auth-modal-utils";

export type AuthEndpointUser = {
  id: string;
  email: string;
  username: string;
  emailVerified?: boolean;
};

export type AuthEndpointResponse = {
  error?: string;
  message?: string;
  email?: string;
  devCode?: string;
  requiresCode?: boolean;
  requiresVerification?: boolean;
  user?: AuthEndpointUser | null;
};

async function postAuthJson(
  endpoint: string,
  body?: Record<string, unknown>
) {
  const res = await fetch(endpoint, {
    method: "POST",
    ...(body
      ? {
          headers: AUTH_JSON_HEADERS,
          body: JSON.stringify(body),
        }
      : {}),
  });

  const json = await readAuthJson<AuthEndpointResponse>(res);

  return {
    res,
    json,
  };
}

export function submitLogin({
  email,
  password,
  turnstileToken,
}: {
  email: string;
  password: string;
  turnstileToken: string | null;
}) {
  return postAuthJson("/api/login", {
    email,
    password,
    turnstileToken,
  });
}

export function submitLoginCode({ code }: { code: string }) {
  return postAuthJson("/api/login-code", {
    code,
  });
}

export function submitResendLoginCode() {
  return postAuthJson("/api/resend-login-code");
}

export function submitRegister({
  email,
  username,
  password,
  turnstileToken,
}: {
  email: string;
  username: string;
  password: string;
  turnstileToken: string | null;
}) {
  return postAuthJson("/api/register", {
    email,
    username,
    password,
    turnstileToken,
  });
}

export function submitForgotPassword({
  email,
  turnstileToken,
}: {
  email: string;
  turnstileToken: string | null;
}) {
  return postAuthJson("/api/forgot-password", {
    email,
    turnstileToken,
  });
}

export function submitResetPassword({
  email,
  code,
  newPassword,
  turnstileToken,
}: {
  email: string;
  code: string;
  newPassword: string;
  turnstileToken: string | null;
}) {
  return postAuthJson("/api/reset-password", {
    email,
    code,
    newPassword,
    turnstileToken,
  });
}

export function submitVerifyEmail({
  email,
  code,
  turnstileToken,
}: {
  email: string;
  code: string;
  turnstileToken: string | null;
}) {
  return postAuthJson("/api/verify-email", {
    email,
    code,
    turnstileToken,
  });
}

export function submitResendVerification({
  email,
  turnstileToken,
}: {
  email: string;
  turnstileToken: string | null;
}) {
  return postAuthJson("/api/resend-verification", {
    email,
    turnstileToken,
  });
}
