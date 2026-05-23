"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthModal, { type AuthView } from "@/app/components/rad/auth-modal";

export default function RegisterPage() {
  const router = useRouter();
  const [view, setView] = useState<AuthView>("register");
  const [email, setEmail] = useState("");

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
