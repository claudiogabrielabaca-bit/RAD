"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const initialEmail = useMemo(
    () => searchParams.get("email") ?? "",
    [searchParams]
  );

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
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
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
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
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Could not reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b1220] text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-10">
        <div className="w-full rounded-[28px] border border-white/10 bg-white/[0.05] p-6 shadow-2xl sm:p-8">
          <div className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">
            Account recovery
          </div>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
            Reset your password
          </h1>

          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Enter your email, the 6-digit recovery code, and your new password.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm text-zinc-300">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-white/10 bg-[#07101f]/75 px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:ring-2 focus:ring-white/10"
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
                className="w-full rounded-2xl border border-white/10 bg-[#07101f]/75 px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:ring-2 focus:ring-white/10"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-300">
                New password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full rounded-2xl border border-white/10 bg-[#07101f]/75 px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:ring-2 focus:ring-white/10"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-300">
                Confirm new password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                className="w-full rounded-2xl border border-white/10 bg-[#07101f]/75 px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:ring-2 focus:ring-white/10"
              />
            </div>

            {message ? (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                {message}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
              >
                {loading ? "Updating..." : "Reset password"}
              </button>

              <Link
                href="/forgot-password"
                className="text-sm text-zinc-400 underline underline-offset-4 transition hover:text-white"
              >
                Back
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#0b1220] text-zinc-100">
          <div className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-10">
            <div className="w-full rounded-[28px] border border-white/10 bg-white/[0.05] p-8 text-zinc-300">
              Loading...
            </div>
          </div>
        </main>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}