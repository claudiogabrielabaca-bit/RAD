import { Suspense } from "react";
import ProfilePageClient from "./profile-page-client";

function ProfilePageFallback() {
  return (
    <main className="min-h-screen bg-transparent text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="animate-pulse">
              <div className="h-6 w-24 rounded bg-white/10" />
              <div className="mt-5 h-24 w-full rounded-3xl bg-white/10" />
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="h-20 rounded-2xl bg-white/10" />
                <div className="h-20 rounded-2xl bg-white/10" />
                <div className="h-20 rounded-2xl bg-white/10" />
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="h-72 animate-pulse rounded-[28px] border border-white/10 bg-white/[0.045] backdrop-blur-xl" />
            <div className="h-72 animate-pulse rounded-[28px] border border-white/10 bg-white/[0.045] backdrop-blur-xl" />
          </div>

          <div className="h-80 animate-pulse rounded-[28px] border border-white/10 bg-white/[0.045] backdrop-blur-xl" />
        </div>
      </div>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfilePageFallback />}>
      <ProfilePageClient />
    </Suspense>
  );
}