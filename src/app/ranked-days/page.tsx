import RankedDaysPanel from "@/app/components/rad/ranked-days-panel";

export default function RankedDaysPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-[17px] text-zinc-100">
      <div className="mx-auto max-w-[1280px] px-8 py-12 xl:px-10">
        <section className="overflow-hidden rounded-[36px] border border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02))] shadow-[0_30px_100px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
          <div className="relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.07),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.035),transparent_28%)]" />

            <div className="relative p-8 sm:p-10 lg:p-12">
              <div className="mb-8">
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Ranked Days
                </h1>
                <p className="mt-2 text-sm text-zinc-400 sm:text-base">
                  Community rankings for the most loved and most controversial days.
                </p>
              </div>

              <RankedDaysPanel />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}