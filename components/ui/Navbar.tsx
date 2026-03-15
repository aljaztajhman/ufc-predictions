"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="fixed top-2 left-0 right-0 z-40 px-4">
      <nav className="max-w-7xl mx-auto">
        <div className="bg-black/70 backdrop-blur-xl border border-white/8 rounded-xl px-4 sm:px-6 py-3 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative w-8 h-8 bg-ufc-red rounded-md flex items-center justify-center group-hover:bg-ufc-red-dark transition-colors">
              <span className="text-white font-black text-sm leading-none">UFC</span>
            </div>
            <div className="hidden sm:block">
              <span className="text-white font-bold text-sm tracking-wide">PREDICTIONS</span>
              <div className="h-px bg-ufc-red w-0 group-hover:w-full transition-all duration-300" />
            </div>
          </Link>

          {/* Nav links */}
          <div className="flex items-center gap-1">
            <Link
              href="/"
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                pathname === "/"
                  ? "text-white bg-white/8"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              )}
            >
              Events
            </Link>
            <div className="flex items-center gap-1.5 ml-2 px-2.5 py-1 bg-ufc-red/10 border border-ufc-red/20 rounded-full">
              <div className="w-1.5 h-1.5 bg-ufc-red rounded-full animate-pulse" />
              <span className="text-ufc-red text-xs font-semibold uppercase tracking-wider">AI Powered</span>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
