"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          username,
          password,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(json?.error ?? "Could not register.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Could not register.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b1220] px-6 py-12 text-zinc-100">
      <div className="mx-auto max-w-md">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl">
          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            Create account
          </div>

          <h1 className="mt-3 text-3xl font-semibold text-white">Register</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Save your ratings, keep your favorite days, and build your profile.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm text-zinc-300">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-[#07101f]/75 px-4 py-3 text-sm text-white outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10"
                placeholder="you@email.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-300">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))
                }
                className="w-full rounded-2xl border border-white/10 bg-[#07101f]/75 px-4 py-3 text-sm text-white outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10"
                placeholder="gabriel"
                autoComplete="username"
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
                className="w-full rounded-2xl border border-white/10 bg-[#07101f]/75 px-4 py-3 text-sm text-white outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10"
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            </div>

            {error ? <div className="text-sm text-red-400">{error}</div> : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}