"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { User, LogOut, ChevronDown, Shield } from "lucide-react";

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

  const username = session.user.name ?? session.user.email ?? "User";
  const role = (session.user as any).role as string | undefined;
  const isAdmin = role === "admin";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-all"
      >
        <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
          <User size={11} className="text-white/70" />
        </div>
        <span className="text-white/80 text-sm font-medium">{username}</span>
        {isAdmin && <Shield size={11} className="text-[#D20A0A]" />}
        <ChevronDown
          size={12}
          className={`text-white/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-[#13151f] border border-white/10 rounded-xl shadow-xl shadow-black/40 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-white/8">
            <p className="text-white text-sm font-semibold">{username}</p>
            <p className="text-white/35 text-xs mt-0.5 capitalize">{role ?? "user"}</p>
          </div>
          <div className="p-1.5">
            <button
              onClick={() => { setOpen(false); signOut({ callbackUrl: "/login" }); }}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/6 transition-all"
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
