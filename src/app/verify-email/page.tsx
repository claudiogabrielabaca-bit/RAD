"use client";

import Link from "next/link";
import { useState } from "react";

export default function VerifyEmailPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState("");

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: code.trim() }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(json?.error ?? "Could not verify email.");
        return;
      }

      setMessage(json?.message ?? "Email verified successfully.");
      setCode("");
      setDevCode("");
    } catch {
      setError("Could not verify email.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(json?.error ?? "Could not resend verification code.");
        return;
      }

      setMessage(json?.message ?? "Verification code regenerated.");
      setDevCode(json?.devCode ?? "");
    } catch {
      setError("Could not resend verification code.");
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b1220] text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-10">
        <div className="w-full rounded-[28px] border border-white/10 bg-white/[0.05] p-6 shadow-2xl sm:p-8">
          <div className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">
            Account security
          </div>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
            Verify your email
          </h1>

          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Enter the 6-digit verification code. For now, while email sending is
            not connected yet, the generated code will appear on screen after you
            resend it.
          </p>

          <form onSubmit={handleVerify} className="mt-8 space-y-5">
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

            {devCode ? (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-amber-300">
                  Dev verification code
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-[0.2em] text-white">
                  {devCode}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
              >
                {loading ? "Verifying..." : "Verify email"}
              </button>

              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:opacity-60"
              >
                {resending ? "Generating..." : "Resend code"}
              </button>

              <Link
                href="/profile"
                className="text-sm text-zinc-400 underline underline-offset-4 transition hover:text-white"
              >
                Back to profile
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}