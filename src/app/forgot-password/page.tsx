"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    setDevCode("");

    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(json?.error ?? "Could not process request.");
        return;
      }

      setMessage(
        json?.message ??
          "If that email exists, a recovery code was generated."
      );
      setDevCode(json?.devCode ?? "");
    } catch {
      setError("Could not process request.");
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
            Forgot your password?
          </h1>

          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Enter your email and we’ll generate a recovery code. For now, while
            mail sending is not connected yet, the code will appear here in dev.
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
                  Dev reset code
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-[0.2em] text-white">
                  {devCode}
                </div>

                <Link
                  href={`/reset-password?email=${encodeURIComponent(
                    email.trim().toLowerCase()
                  )}`}
                  className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
                >
                  Continue to reset password
                </Link>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
              >
                {loading ? "Generating..." : "Send recovery code"}
              </button>

              <Link
                href="/"
                className="text-sm text-zinc-400 underline underline-offset-4 transition hover:text-white"
              >
                Back home
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}