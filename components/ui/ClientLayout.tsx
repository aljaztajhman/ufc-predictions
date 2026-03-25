"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./Navbar";
import { SessionGuard } from "./SessionGuard";

/**
 * Wraps the app shell (Navbar + main + footer) and hides them on the login page.
 * Must be a client component to read the current pathname.
 */
export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login";

  if (isAuthPage) {
    // Login page: render children only — no navbar, no footer, no padding
    return <>{children}</>;
  }

  return (
    <>
      <SessionGuard />
      <Navbar />
      <main className="relative z-10 pt-14">{children}</main>
      <footer className="relative z-10 mt-24 border-t border-white/5 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #D20A0A, #FF2525)" }}
            >
              <span className="text-white text-xs font-black">U</span>
            </div>
            <span className="text-white/35 text-sm font-medium">UFC Predictions</span>
          </div>
          <p className="text-white/20 text-xs text-center">
            For entertainment only. Predictions powered by AI — not financial or betting advice.
          </p>
        </div>
      </footer>
    </>
  );
}
