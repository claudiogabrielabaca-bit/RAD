"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SiteHeader() {
  const pathname = usePathname();

  const isDiscoverActive = pathname === "/";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.07] bg-black/72 backdrop-blur-xl">
      <div className="flex h-16 w-full items-center justify-between px-5 sm:px-6 lg:px-8">
        <div className="flex items-center">
          <nav className="flex items-center gap-5 sm:gap-6">
            <Link
              href="/"
              className={`relative pb-1 text-[15px] font-medium tracking-[-0.01em] transition ${
                isDiscoverActive
                  ? "text-white"
                  : "text-white/72 hover:text-white"
              }`}
            >
              Discover
              {isDiscoverActive ? (
                <span className="absolute bottom-[-17px] left-0 h-[2px] w-full rounded-full bg-white" />
              ) : null}
            </Link>

            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/14" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/10" />
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-[15px] font-medium text-white/82 transition hover:text-white"
          >
            Log in
          </Link>

          <Link
            href="/register"
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white px-5 text-[15px] font-semibold text-black transition hover:bg-white/92"
          >
            Register
          </Link>
        </div>
      </div>
    </header>
  );
}