"use client";

import React, { useEffect, useMemo, useState } from "react";
import TurnstileWidget from "@/app/components/rad/turnstile-widget";

export type AuthView =
  | "login"
  | "login-code"
  | "register"
  | "forgot-password"
  | "reset-password"
  | "verify-email";

type MeUser = {
  id: string;
  email: string;
  username: string;
  emailVerified?: boolean;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6A3 3 0 0 0 13.4 13.4" />
      <path d="M9.88 5.1A10.94 10.94 0 0 1 12 4.9c6.4 0 10 7.1 10 7.1a18.4 18.4 0 0 1-4.11 4.98" />
      <path d="M6.1 6.1A18.76 18.76 0 0 0 2 12s3.6 7.1 10 7.1a10.7 10.7 0 0 0 5.03-1.2" />
    </svg>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  visible,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-zinc-300">{label}</label>

      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-white/10 bg-[#181818]/90 px-4 py-3 pr-12 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:ring-2 focus:ring-white/10"
        />

        <button
          type="button"
          onClick={onToggle}
          className="absolute inset-y-0 right-3 flex items-center text-zinc-400 transition hover:text-white"
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}

export default function AuthModal({
  open,
  view,
  initialEmail = "",
  onClose,
  onChangeView,
  onAuthSuccess,
}: {
  open: boolean;
  view: AuthView;
  initialEmail?: string;
  onClose: () => void;
  onChangeView: (view: AuthView, nextEmail?: string) => void;
  onAuthSuccess?: (user?: MeUser | null) => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [secondaryLoading, setSecondaryLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState("");

  const [currentUserEmailVerified, setCurrentUserEmailVerified] = useState<
    boolean | null
  >(null);

  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  function resetTurnstile() {
    setTurnstileToken("");
    setTurnstileResetKey((prev) => prev + 1);
  }

  function requireTurnstile(actionLabel = "continue") {
    if (!turnstileToken) {
      setError(`Complete the security check before trying to ${actionLabel}.`);
      return false;
    }

    return true;
  }

  useEffect(() => {
    if (!open) {
      setEmail(initialEmail || "");
      setUsername("");
      setPassword("");
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("");
      setError("");
      setDevCode("");
      setLoading(false);
      setSecondaryLoading(false);
      setCurrentUserEmailVerified(null);
      setTurnstileToken("");
      setShowLoginPassword(false);
      setShowRegisterPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      return;
    }

    setEmail(initialEmail || "");
    setLoading(false);
    setSecondaryLoading(false);
    setCurrentUserEmailVerified(null);
    resetTurnstile();
    setShowLoginPassword(false);
    setShowRegisterPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);

    if (view === "login") {
      setPassword("");
      setCode("");
    }

    if (view === "login-code") {
      setCode("");
    }

    if (view === "register") {
      setUsername("");
      setPassword("");
      setCode("");
    }

    if (view === "forgot-password") {
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
    }

    if (view === "reset-password") {
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
    }

    if (view === "verify-email") {
      setCode("");
    }
  }, [open, view, initialEmail]);

  useEffect(() => {
    if (!open) return;

    async function loadMe() {
      try {
        const res = await fetch("/api/me", {
          cache: "no-store",
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          setCurrentUserEmailVerified(null);
          return;
        }

        const meEmail =
          typeof json?.user?.email === "string"
            ? normalizeEmail(json.user.email)
            : "";

        const formEmail = normalizeEmail(initialEmail || email);

        if (meEmail && formEmail && meEmail === formEmail) {
          setCurrentUserEmailVerified(
            typeof json?.user?.emailVerified === "boolean"
              ? json.user.emailVerified
              : null
          );
        } else {
          setCurrentUserEmailVerified(null);
        }
      } catch {
        setCurrentUserEmailVerified(null);
      }
    }

    if (view === "verify-email") {
      loadMe();
    }
  }, [open, view, initialEmail, email]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const title = useMemo(() => {
    switch (view) {
      case "login":
        return "Log in";
      case "login-code":
        return "Enter login code";
      case "register":
        return "Create account";
      case "forgot-password":
        return "Forgot password";
      case "reset-password":
        return "Reset password";
      case "verify-email":
        return "Verify your email";
      default:
        return "Account";
    }
  }, [view]);

  const subtitle = useMemo(() => {
    switch (view) {
      case "login":
        return "Step 1: enter your email and password.";
      case "login-code":
        return "Step 2: enter the access code sent to your email.";
      case "register":
        return "Create your RAD account to save ratings and favorites.";
      case "forgot-password":
        return "Enter your email and generate a recovery code.";
      case "reset-password":
        return "Use your recovery code and choose a new password.";
      case "verify-email":
        return "Confirm that this email belongs to you.";
      default:
        return "";
    }
  }, [view]);

  const codeIsComplete = code.trim().length === 6;

  async function refreshUserAndNotify() {
    try {
      const res = await fetch("/api/me", {
        cache: "no-store",
      });

      const json = await res.json().catch(() => null);

      if (res.ok) {
        onAuthSuccess?.(json?.user ?? null);
      } else {
        onAuthSuccess?.(null);
      }
    } catch {
      onAuthSuccess?.(null);
    }
  }

  function goToView(
    nextView: AuthView,
    nextEmail?: string,
    options?: {
      nextMessage?: string;
      nextError?: string;
      nextDevCode?: string;
    }
  ) {
    setMessage(options?.nextMessage ?? "");
    setError(options?.nextError ?? "");
    setDevCode(options?.nextDevCode ?? "");
    resetTurnstile();
    onChangeView(nextView, nextEmail ?? email);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    setDevCode("");

    if (!requireTurnstile("continue")) {
      setLoading(false);
      return;
    }

    try {
      const normalized = normalizeEmail(email);

      const res = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalized,
          password,
          turnstileToken,
        }),
      });

      resetTurnstile();

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (json?.requiresVerification) {
          goToView("verify-email", json?.email ?? normalized, {
            nextMessage: "This account must verify email first.",
            nextDevCode: json?.devCode ?? "",
          });
          return;
        }

        setError(json?.error ?? "Could not log in.");
        return;
      }

      if (json?.requiresCode) {
        goToView("login-code", json?.email ?? normalized, {
          nextMessage: json?.message ?? "Enter the login code.",
          nextDevCode: json?.devCode ?? "",
        });
        return;
      }

      setError("Unexpected login response.");
    } catch {
      resetTurnstile();
      setError("Could not log in.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoginCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/login-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizeEmail(email),
          code: code.trim(),
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(json?.error ?? "Could not validate login code.");
        return;
      }

      await refreshUserAndNotify();
      setMessage("Logged in successfully.");

      setTimeout(() => {
        onClose();
      }, 500);
    } catch {
      setError("Could not validate login code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendLoginCode() {
    setSecondaryLoading(true);
    setMessage("");
    setError("");
    setDevCode("");

    try {
      const res = await fetch("/api/resend-login-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizeEmail(email),
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(json?.error ?? "Could not resend login code.");
        return;
      }

      setMessage(json?.message ?? "New login code sent.");
      setDevCode(json?.devCode ?? "");
    } catch {
      setError("Could not resend login code.");
    } finally {
      setSecondaryLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    setDevCode("");

    if (!requireTurnstile("create an account")) {
      setLoading(false);
      return;
    }

    try {
      const normalized = normalizeEmail(email);

      const res = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalized,
          username: username.trim().toLowerCase(),
          password,
          turnstileToken,
        }),
      });

      resetTurnstile();

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(json?.error ?? "Could not create account.");
        return;
      }

      goToView("verify-email", json?.user?.email ?? normalized, {
        nextMessage:
          json?.message ?? "Account created successfully. Verify your email.",
        nextDevCode: json?.devCode ?? "",
      });
    } catch {
      resetTurnstile();
      setError("Could not create account.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    setDevCode("");

    if (!requireTurnstile("send the recovery code")) {
      setLoading(false);
      return;
    }

    try {
      const normalized = normalizeEmail(email);

      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalized,
          turnstileToken,
        }),
      });

      resetTurnstile();

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(json?.error ?? "Could not process request.");
        return;
      }

      goToView("reset-password", normalized, {
        nextMessage:
          json?.message ?? "If that email exists, a recovery code was sent.",
        nextDevCode: json?.devCode ?? "",
      });
    } catch {
      resetTurnstile();
      setError("Could not process request.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const normalized = normalizeEmail(email);

      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalized,
          code: code.trim(),
          newPassword,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(json?.error ?? "Could not reset password.");
        return;
      }

      setMessage(
        json?.message ?? "Password updated successfully. Please log in again."
      );

      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setCode("");

      setTimeout(() => {
        goToView("login", normalized);
      }, 900);
    } catch {
      setError("Could not reset password.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    if (!requireTurnstile("verify your email")) {
      setLoading(false);
      return;
    }

    try {
      const normalized = normalizeEmail(email);

      const res = await fetch("/api/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalized,
          code: code.trim(),
          turnstileToken,
        }),
      });

      resetTurnstile();

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(json?.error ?? "Could not verify email.");
        return;
      }

      setMessage(json?.message ?? "Email verified successfully.");
      setCurrentUserEmailVerified(true);
      setCode("");

      await refreshUserAndNotify();

      setTimeout(() => {
        goToView("login", normalized);
      }, 900);
    } catch {
      resetTurnstile();
      setError("Could not verify email.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    setSecondaryLoading(true);
    setMessage("");
    setError("");
    setDevCode("");

    if (!requireTurnstile("resend the verification code")) {
      setSecondaryLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizeEmail(email),
          turnstileToken,
        }),
      });

      resetTurnstile();

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(json?.error ?? "Could not resend verification code.");
        return;
      }

      setMessage(json?.message ?? "Verification code sent.");
      setDevCode(json?.devCode ?? "");
    } catch {
      resetTurnstile();
      setError("Could not resend verification code.");
    } finally {
      setSecondaryLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative z-[91] w-full max-w-lg overflow-hidden rounded-[30px] border border-white/10 bg-[#121212]/95 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.03),transparent_26%)]" />

        <div className="relative p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                RAD Account
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                {title}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
                {subtitle}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/10"
            >
              Close
            </button>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4 backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => goToView("login", email)}
                className={`rounded-xl px-3 py-2 text-sm transition ${
                  view === "login"
                    ? "bg-white text-black"
                    : "bg-white/5 text-zinc-300 hover:bg-white/10"
                }`}
              >
                Log in
              </button>

              <button
                type="button"
                onClick={() => goToView("register", email)}
                className={`rounded-xl px-3 py-2 text-sm transition ${
                  view === "register"
                    ? "bg-white text-black"
                    : "bg-white/5 text-zinc-300 hover:bg-white/10"
                }`}
              >
                Create account
              </button>

              {view === "login-code" ? (
                <div className="rounded-xl bg-white px-3 py-2 text-sm text-black">
                  Login code
                </div>
              ) : null}

              {view === "forgot-password" ? (
                <div className="rounded-xl bg-white px-3 py-2 text-sm text-black">
                  Forgot password
                </div>
              ) : null}

              {view === "reset-password" ? (
                <div className="rounded-xl bg-white px-3 py-2 text-sm text-black">
                  Reset password
                </div>
              ) : null}

              {view === "verify-email" ? (
                <div className="rounded-xl bg-white px-3 py-2 text-sm text-black">
                  Verify email
                </div>
              ) : null}
            </div>
          </div>

          {message ? (
            <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {devCode ? (
            <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-amber-300">
                Dev code
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-[0.22em] text-white">
                {devCode}
              </div>
            </div>
          ) : null}

          {view === "login" ? (
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm text-zinc-300">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-white/10 bg-[#181818]/90 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:ring-2 focus:ring-white/10"
                />
              </div>

              <PasswordField
                label="Password"
                value={password}
                onChange={setPassword}
                placeholder="Your password"
                visible={showLoginPassword}
                onToggle={() => setShowLoginPassword((prev) => !prev)}
              />

              <TurnstileWidget
                key={`turnstile-${view}-${turnstileResetKey}`}
                resetKey={turnstileResetKey}
                onTokenChange={setTurnstileToken}
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
                >
                  {loading ? "Checking..." : "Continue"}
                </button>

                <button
                  type="button"
                  onClick={() => goToView("forgot-password", email)}
                  className="text-sm text-zinc-400 underline underline-offset-4 transition hover:text-white"
                >
                  Forgot password?
                </button>
              </div>
            </form>
          ) : null}

          {view === "login-code" ? (
            <form onSubmit={handleLoginCode} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm text-zinc-300">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-white/10 bg-[#181818]/90 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:ring-2 focus:ring-white/10"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Login code
                </label>
                <input
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputMode="numeric"
                  placeholder="123456"
                  className="w-full rounded-2xl border border-white/10 bg-[#181818]/90 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:ring-2 focus:ring-white/10"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading || !codeIsComplete}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
                >
                  {loading ? "Logging in..." : "Access account"}
                </button>

                <button
                  type="button"
                  onClick={handleResendLoginCode}
                  disabled={secondaryLoading}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:opacity-60"
                >
                  {secondaryLoading ? "Generating..." : "Resend code"}
                </button>

                <button
                  type="button"
                  onClick={() => goToView("login", email)}
                  className="text-sm text-zinc-400 underline underline-offset-4 transition hover:text-white"
                >
                  Back
                </button>
              </div>
            </form>
          ) : null}

          {view === "register" ? (
            <form onSubmit={handleRegister} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm text-zinc-300">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-white/10 bg-[#181818]/90 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:ring-2 focus:ring-white/10"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Username
                </label>
                <input
                  value={username}
                  onChange={(e) =>
                    setUsername(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9_]/g, "")
                        .slice(0, 20)
                    )
                  }
                  placeholder="your_username"
                  className="w-full rounded-2xl border border-white/10 bg-[#181818]/90 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:ring-2 focus:ring-white/10"
                />
              </div>

              <PasswordField
                label="Password"
                value={password}
                onChange={setPassword}
                placeholder="At least 8 characters"
                visible={showRegisterPassword}
                onToggle={() => setShowRegisterPassword((prev) => !prev)}
              />

              <TurnstileWidget
                key={`turnstile-${view}-${turnstileResetKey}`}
                resetKey={turnstileResetKey}
                onTokenChange={setTurnstileToken}
              />

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
                >
                  {loading ? "Creating..." : "Create account"}
                </button>
              </div>
            </form>
          ) : null}

          {view === "forgot-password" ? (
            <form onSubmit={handleForgotPassword} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm text-zinc-300">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-white/10 bg-[#181818]/90 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:ring-2 focus:ring-white/10"
                />
              </div>

              <TurnstileWidget
                key={`turnstile-${view}-${turnstileResetKey}`}
                resetKey={turnstileResetKey}
                onTokenChange={setTurnstileToken}
              />

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
                >
                  {loading ? "Generating..." : "Send recovery code"}
                </button>

                <button
                  type="button"
                  onClick={() => goToView("login", email)}
                  className="text-sm text-zinc-400 underline underline-offset-4 transition hover:text-white"
                >
                  Back to login
                </button>
              </div>
            </form>
          ) : null}

          {view === "reset-password" ? (
            <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm text-zinc-300">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-white/10 bg-[#181818]/90 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:ring-2 focus:ring-white/10"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Recovery code
                </label>
                <input
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputMode="numeric"
                  placeholder="123456"
                  className="w-full rounded-2xl border border-white/10 bg-[#181818]/90 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:ring-2 focus:ring-white/10"
                />
              </div>

              <PasswordField
                label="New password"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="At least 8 characters"
                visible={showNewPassword}
                onToggle={() => setShowNewPassword((prev) => !prev)}
              />

              <PasswordField
                label="Confirm new password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Repeat password"
                visible={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((prev) => !prev)}
              />

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading || !codeIsComplete}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
                >
                  {loading ? "Updating..." : "Reset password"}
                </button>

                <button
                  type="button"
                  onClick={() => goToView("forgot-password", email)}
                  className="text-sm text-zinc-400 underline underline-offset-4 transition hover:text-white"
                >
                  Back
                </button>
              </div>
            </form>
          ) : null}

          {view === "verify-email" ? (
            <form onSubmit={handleVerifyEmail} className="mt-6 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                  Verification status
                </div>

                <div className="mt-2 text-sm text-zinc-200">
                  {currentUserEmailVerified === true
                    ? "Your email is already verified."
                    : "Your email is not verified yet."}
                </div>

                {email ? (
                  <div className="mt-1 text-xs text-zinc-500">{email}</div>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Verification code
                </label>
                <input
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputMode="numeric"
                  placeholder="123456"
                  className="w-full rounded-2xl border border-white/10 bg-[#181818]/90 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:ring-2 focus:ring-white/10"
                />
              </div>

              <TurnstileWidget
                key={`turnstile-${view}-${turnstileResetKey}`}
                resetKey={turnstileResetKey}
                onTokenChange={setTurnstileToken}
              />

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={
                    loading ||
                    currentUserEmailVerified === true ||
                    !codeIsComplete
                  }
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
                >
                  {loading ? "Verifying..." : "Verify email"}
                </button>

                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={secondaryLoading || currentUserEmailVerified === true}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:opacity-60"
                >
                  {secondaryLoading ? "Generating..." : "Resend code"}
                </button>

                <button
                  type="button"
                  onClick={() => goToView("login", email)}
                  className="text-sm text-zinc-400 underline underline-offset-4 transition hover:text-white"
                >
                  Back to login
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}