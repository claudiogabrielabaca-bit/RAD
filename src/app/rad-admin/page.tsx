"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RadAdminLoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(json?.error ?? "Could not log in.");
        return;
      }

      router.push("/rad-control-room");
      router.refresh();
    } catch {
      setError("Could not log in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b1220] px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-md">
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
          <div className="mb-6">
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              RAD Admin
            </div>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              Control Room Login
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Enter your admin credentials to access moderation tools.
            </p>
          </div>

          {error ? (
            <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm text-zinc-300">
                Username
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Admin username"
                className="w-full rounded-2xl border border-white/10 bg-[#101826] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:ring-2 focus:ring-white/10"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-300">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Admin password"
                className="w-full rounded-2xl border border-white/10 bg-[#101826] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20 focus:ring-2 focus:ring-white/10"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Enter control room"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
