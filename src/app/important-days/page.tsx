"use client";

import { useRouter } from "next/navigation";
import ImportantDaysStrip from "@/app/components/rad/important-days-strip";

export default function ImportantDaysPage() {
  const router = useRouter();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-[17px] text-zinc-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.022),rgba(255,255,255,0.008))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.045),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.018),transparent_22%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-[1280px] px-8 pt-40 pb-12 xl:px-10">
        <ImportantDaysStrip
          onSelectDay={(selectedDay) => {
            router.push(`/?day=${encodeURIComponent(selectedDay)}`);
          }}
        />
      </div>
    </main>
  );
}