"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "./UserMenu";
import { useSlip } from "@/contexts/SlipContext";

export function Navbar() {
  const pathname = usePathname();
  const { picks, drawerOpen, setDrawerOpen } = useSlip();
  const pickCount = picks.length;

  return (
    <header className="fixed top-0 left-0 right-0 z-40">
      <div className="bg-[#0D0F18]/80 backdrop-blur-2xl border-b border-white/6">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div
                className="relative w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #D20A0A, #FF2525)" }}
              >
                <span className="text-white font-black text-[11px] leading-none tracking-tight">UFC</span>
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="text-white font-bold text-sm tracking-widest uppercase">
                Predictions
              </span>
            </Link>

            {/* Nav right */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/"
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                  pathname === "/"
                    ? "text-white bg-white/10"
                    : "text-white/50 hover:text-white hover:bg-white/6"
                )}
              >
                Events
              </Link>

              {/* AI badge — hidden on small screens to save space */}
              <div
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border"
                style={{
                  background: "rgba(210,10,10,0.1)",
                  borderColor: "rgba(210,10,10,0.25)",
                }}
              >
                <span className="w-1.5 h-1.5 bg-ufc-red rounded-full animate-pulse" />
                <span className="text-ufc-red text-[11px] font-semibold uppercase tracking-wider">
                  AI Powered
                </span>
              </div>

              {/* Slip button */}
              <button
                onClick={() => setDrawerOpen(!drawerOpen)}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200",
                  drawerOpen
                    ? "text-white bg-white/10 border-white/15"
                    : pickCount > 0
                    ? "border-[#D20A0A]/35 bg-[#D20A0A]/8 text-white/80 hover:bg-[#D20A0A]/12"
                    : "text-white/45 border-white/8 bg-transparent hover:text-white/70 hover:bg-white/6"
                )}
                aria-label="Open prediction slip"
              >
                <ClipboardList size={14} className={pickCount > 0 && !drawerOpen ? "text-[#FF2525]" : ""} />
                <span className="hidden sm:block">Slip</span>
                {pickCount > 0 && (
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black text-white leading-none"
                    style={{ background: "linear-gradient(135deg, #D20A0A, #FF2525)" }}
                  >
                    {pickCount}
                  </span>
                )}
              </button>

              <UserMenu />
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
