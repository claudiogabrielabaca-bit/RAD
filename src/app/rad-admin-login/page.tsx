"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RadAdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(json?.error ?? "Could not login");
        return;
      }

      router.push("/rad-control-room");
      router.refresh();
    } catch {
      setError("Could not login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b1220] text-zinc-100 flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
        <h1 className="text-2xl font-semibold">RAD Admin Login</h1>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-2 block text-sm text-zinc-300">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>

          {error ? <div className="text-sm text-red-300">{error}</div> : null}

          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
          >
            {loading ? "Logging in..." : "Enter control room"}
          </button>
        </div>
      </div>
    </main>
  );
}