"use client";

import React from "react";
import TurnstileWidget from "@/app/components/rad/turnstile-widget";
import { ContextLink, PasswordField } from "@/app/components/rad/auth-modal-parts";
import { useAuthPasswordVisibility } from "@/app/hooks/use-auth-password-visibility";
import { useAuthTurnstile } from "@/app/hooks/use-auth-turnstile";
import { useAuthEmailVerificationStatus } from "@/app/hooks/use-auth-email-verification-status";
import { useAuthFeedbackState } from "@/app/hooks/use-auth-feedback-state";
import { useAuthFormFields } from "@/app/hooks/use-auth-form-fields";
import { useAuthRefreshUser } from "@/app/hooks/use-auth-refresh-user";
import { useAuthModalEscapeClose, useAuthModalLifecycle } from "@/app/hooks/use-auth-modal-effects";
import {
  submitForgotPassword,
  submitLogin,
  submitLoginCode,
  submitRegister,
  submitResendLoginCode,
  submitResendVerification,
  submitResetPassword,
  submitVerifyEmail,
} from "@/app/components/rad/auth-modal-api";
import { getAuthViewContent, normalizeEmail } from "@/app/components/rad/auth-modal-utils";

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
  const {
    email,
    setEmail,
    username,
    setUsername,
    password,
    setPassword,
    code,
    setCode,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
  } = useAuthFormFields(initialEmail);

  const {
    showLoginPassword,
    showRegisterPassword,
    showNewPassword,
    showConfirmPassword,
    toggleLoginPassword,
    toggleRegisterPassword,
    toggleNewPassword,
    toggleConfirmPassword,
    resetPasswordVisibility,
  } = useAuthPasswordVisibility();

  const {
    loading,
    setLoading,
    secondaryLoading,
    setSecondaryLoading,
    message,
    setMessage,
    error,
    setError,
    devCode,
    setDevCode,
    resetAuthFeedback,
    resetAuthLoading,
  } = useAuthFeedbackState();

  const {
    turnstileToken,
    turnstileResetKey,
    setTurnstileToken,
    clearTurnstileToken,
    resetTurnstile,
  } = useAuthTurnstile();

  const {
    currentUserEmailVerified,
    resetCurrentUserEmailVerified,
    markCurrentUserEmailVerified,
    markCurrentUserEmailUnverified,
  } = useAuthEmailVerificationStatus({
      open,
      view,
      initialEmail,
      email,
      setEmail,
    });

  function requireTurnstile(actionLabel = "continue") {
    if (!turnstileToken) {
      setError(`Complete the security check before trying to ${actionLabel}.`);
      return false;
    }

    return true;
  }

  useAuthModalLifecycle({
    open,
    view,
    initialEmail,
    setEmail,
    setUsername,
    setPassword,
    setCode,
    setNewPassword,
    setConfirmPassword,
    resetAuthFeedback,
    resetAuthLoading,
    resetCurrentUserEmailVerified,
    clearTurnstileToken,
    resetTurnstile,
    resetPasswordVisibility,
  });

  useAuthModalEscapeClose({
    open,
    onClose,
  });

  const { title, subtitle } = getAuthViewContent(view);


  const codeIsComplete = code.trim().length === 6;

  const { refreshUserAndNotify } = useAuthRefreshUser({
    onAuthSuccess,
  });

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

      const { res, json } = await submitLogin({
        email: normalized,
        password,
        turnstileToken,
      });

      resetTurnstile();

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

      if (json?.user) {
        onAuthSuccess?.(json.user);
        setMessage("Logged in successfully.");

        setTimeout(() => {
          onClose();
        }, 450);
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
      const { res, json } = await submitLoginCode({
        code: code.trim(),
      });

      if (!res.ok) {
        setError(json?.error ?? "Could not validate login code.");
        return;
      }

      await refreshUserAndNotify();
      setMessage("Logged in successfully.");

      setTimeout(() => {
        onClose();
      }, 450);
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
      const { res, json } = await submitResendLoginCode();

      if (!res.ok) {
        setError(json?.error ?? "Could not resend login code.");
        return;
      }

      if (typeof json?.email === "string" && json.email) {
        setEmail(json.email);
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

      const { res, json } = await submitRegister({
        email: normalized,
        username: username.trim().toLowerCase(),
        password,
        turnstileToken,
      });

      resetTurnstile();

      if (!res.ok) {
        setError(json?.error ?? "Could not create account.");
        return;
      }

      await refreshUserAndNotify();
      markCurrentUserEmailUnverified();

      goToView("verify-email", json?.user?.email ?? normalized, {
        nextMessage:
          json?.message ??
          "Account created successfully. You're already signed in. Verify your email when you're ready.",
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

      const { res, json } = await submitForgotPassword({
        email: normalized,
        turnstileToken,
      });

      resetTurnstile();

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

    if (!requireTurnstile("reset your password")) {
      setLoading(false);
      return;
    }

    try {
      const normalized = normalizeEmail(email);

      const { res, json } = await submitResetPassword({
        email: normalized,
        code: code.trim(),
        newPassword,
        turnstileToken,
      });

      resetTurnstile();

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
      resetTurnstile();
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

      const { res, json } = await submitVerifyEmail({
        email: normalized,
        code: code.trim(),
        turnstileToken,
      });

      resetTurnstile();

      if (!res.ok) {
        setError(json?.error ?? "Could not verify email.");
        return;
      }

      setMessage(json?.message ?? "Email verified successfully.");
      markCurrentUserEmailVerified();
      setCode("");

      const nextUser = await refreshUserAndNotify();

      setTimeout(() => {
        if (nextUser) {
          onClose();
        } else {
          goToView("login", normalized);
        }
      }, 700);
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
      const { res, json } = await submitResendVerification({
        email: normalizeEmail(email),
        turnstileToken,
      });

      resetTurnstile();

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

      <div className="relative z-[91] w-full max-w-[560px] overflow-hidden rounded-[32px] border border-white/10 bg-[#121212]/95 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.03),transparent_26%)]" />

        <div className="relative p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                RAD Account
              </div>
              <h2 className="mt-2 text-[2.1rem] font-semibold tracking-tight text-white leading-none">
                {title}
              </h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-zinc-400">
                {subtitle}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white/10"
            >
              Close
            </button>
          </div>

          {view === "login" ? (
            <ContextLink
              text="Don't have an account yet?"
              action="Create account"
              onClick={() => goToView("register", email)}
            />
          ) : null}

          {view === "register" ? (
            <ContextLink
              text="Already have an account?"
              action="Log in"
              onClick={() => goToView("login", email)}
            />
          ) : null}

          {view === "forgot-password" ? (
            <ContextLink
              text="Remembered your password?"
              action="Back to login"
              onClick={() => goToView("login", email)}
            />
          ) : null}

          {view === "reset-password" ? (
            <ContextLink
              text="Need to generate a new recovery code?"
              action="Back"
              onClick={() => goToView("forgot-password", email)}
            />
          ) : null}

          {view === "verify-email" ? (
            <ContextLink
              text="Want to verify later?"
              action="Close"
              onClick={onClose}
            />
          ) : null}

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
            <form onSubmit={handleLogin} className="mt-6 space-y-5">
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
                onToggle={toggleLoginPassword}
              />

              <TurnstileWidget
                key={`turnstile-${view}-${turnstileResetKey}`}
                resetKey={turnstileResetKey}
                onTokenChange={setTurnstileToken}
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
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
            <form onSubmit={handleLoginCode} className="mt-6 space-y-5">
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

              <div className="flex flex-wrap items-center gap-3 pt-1">
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
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => goToView("login", email)}
                  className="text-sm text-zinc-400 underline underline-offset-4 transition hover:text-white"
                >
                  Use another email
                </button>
              </div>
            </form>
          ) : null}

          {view === "register" ? (
            <form onSubmit={handleRegister} className="mt-6 space-y-5">
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
                onToggle={toggleRegisterPassword}
              />

              <TurnstileWidget
                key={`turnstile-${view}-${turnstileResetKey}`}
                resetKey={turnstileResetKey}
                onTokenChange={setTurnstileToken}
              />

              <div className="pt-1">
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
            <form onSubmit={handleForgotPassword} className="mt-6 space-y-5">
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

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
                >
                  {loading ? "Generating..." : "Send recovery code"}
                </button>
              </div>
            </form>
          ) : null}

          {view === "reset-password" ? (
            <form onSubmit={handleResetPassword} className="mt-6 space-y-5">
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
                onToggle={toggleNewPassword}
              />

              <PasswordField
                label="Confirm new password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Repeat password"
                visible={showConfirmPassword}
                onToggle={toggleConfirmPassword}
              />

              <TurnstileWidget
                key={`turnstile-${view}-${turnstileResetKey}`}
                resetKey={turnstileResetKey}
                onTokenChange={setTurnstileToken}
              />

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={loading || !codeIsComplete}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
                >
                  {loading ? "Updating..." : "Reset password"}
                </button>
              </div>
            </form>
          ) : null}

          {view === "verify-email" ? (
            <form onSubmit={handleVerifyEmail} className="mt-6 space-y-5">
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

              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                  Verification status
                </div>

                <div className="mt-2 text-sm text-zinc-200">
                  {currentUserEmailVerified === true
                    ? "Your email is already verified."
                    : email
                      ? "Enter the 6-digit code sent to this email."
                      : "Enter your email and the 6-digit verification code."}
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

              <div className="flex flex-wrap items-center gap-3 pt-1">
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
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
