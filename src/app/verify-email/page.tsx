"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthModal, { type AuthView } from "@/app/components/rad/auth-modal";

function VerifyEmailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialEmail = useMemo(
    () => searchParams.get("email") ?? "",
    [searchParams]
  );

  const [view, setView] = useState<AuthView>("verify-email");
  const [email, setEmail] = useState(initialEmail);

  function goHome() {
    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <AuthModal
        open={true}
        view={view}
        initialEmail={email}
        onClose={goHome}
        onChangeView={(nextView, nextEmail) => {
          setView(nextView);

          if (typeof nextEmail === "string") {
            setEmail(nextEmail);
          }
        }}
        onAuthSuccess={() => {
          router.refresh();
        }}
      />
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#050505] text-white">
          <div className="flex min-h-screen items-center justify-center px-6 text-sm text-zinc-400">
            Loading...
          </div>
        </main>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}
