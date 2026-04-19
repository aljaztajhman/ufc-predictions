"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { User, LogOut, ChevronDown, Shield, CreditCard, History } from "lucide-react";
import Link from "next/link";

export function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!session?.user) return null;

  const username    = session.user.name ?? session.user.email ?? "User";
  const role        = (session.user as any).role as string | undefined;
  const subStatus   = (session.user as any).subscriptionStatus as string | undefined;
  const isAdmin     = role === "admin";
  const isLifetime  = subStatus === "lifetime";
  const isActive    = subStatus === "active";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-all"
      >
        <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
          <User size={11} className="text-white/80" />
        </div>
        <span className="text-white/85 text-sm font-medium">{username}</span>
        {isAdmin && <Shield size={11} className="text-[#D20A0A]" />}
        <ChevronDown
          size={12}
          className={`text-white/50 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-[#13151f] border border-white/10 rounded-xl shadow-xl shadow-black/40 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-white/8">
            <p className="text-white text-sm font-semibold">{username}</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-white/55 text-xs capitalize">{role ?? "user"}</p>
              {(isLifetime || isActive || isAdmin) && (
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full border ${
                  isLifetime
                    ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                    : isAdmin
                    ? "text-[#FF4444] bg-red-500/10 border-red-500/20"
                    : "text-green-400 bg-green-500/10 border-green-500/20"
                }`}>
                  {isLifetime ? "Lifetime" : isAdmin ? "Admin" : "Active"}
                </span>
              )}
            </div>
          </div>
          <div className="p-1.5 flex flex-col gap-0.5">
            {/* My Predictions — visible to every signed-in user */}
            <Link
              href="/my-predictions"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/6 transition-all"
            >
              <History size={14} />
              My Predictions
            </Link>
            {/* Renew/subscribe link for non-lifetime, non-admin users */}
            {!isLifetime && !isAdmin && (
              <Link
                href="/subscribe"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/6 transition-all"
              >
                <CreditCard size={14} />
                {isActive ? "Manage Subscription" : "Subscribe"}
              </Link>
            )}
            <button
              onClick={() => { setOpen(false); signOut({ callbackUrl: "/login" }); }}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/6 transition-all"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
