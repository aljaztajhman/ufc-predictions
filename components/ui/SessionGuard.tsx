"use client";

import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;   // 5 minutes
const WARN_BEFORE_MS  = 60 * 1000;        // warn 1 minute before logout

const ACTIVITY_EVENTS = [
  "mousemove", "mousedown", "keydown",
  "touchstart", "scroll", "click",
] as const;

/**
 * Renders nothing visible — just tracks user inactivity.
 * After 5 minutes with no interaction, signs the user out.
 * Shows a 60-second warning before doing so.
 */
export function SessionGuard() {
  const { status } = useSession();
  const [warning, setWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const idleTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearTimers() {
    if (idleTimer.current)  clearTimeout(idleTimer.current);
    if (warnTimer.current)  clearTimeout(warnTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
  }

  function resetTimers() {
    clearTimers();
    setWarning(false);
    setCountdown(60);

    // Show warning at (IDLE_TIMEOUT_MS - WARN_BEFORE_MS)
    warnTimer.current = setTimeout(() => {
      setWarning(true);
      setCountdown(60);
      // Tick countdown
      countdownInterval.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(countdownInterval.current!);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }, IDLE_TIMEOUT_MS - WARN_BEFORE_MS);

    // Sign out at IDLE_TIMEOUT_MS
    idleTimer.current = setTimeout(() => {
      signOut({ callbackUrl: "/login" });
    }, IDLE_TIMEOUT_MS);
  }

  useEffect(() => {
    if (status !== "authenticated") return;

    resetTimers();

    const handler = () => resetTimers();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, handler, { passive: true }));

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, handler));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (!warning) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#13151f] border border-white/10 rounded-2xl p-8 w-full max-w-sm mx-4 shadow-2xl shadow-black/60 text-center">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: "rgba(210,10,10,0.15)", border: "1px solid rgba(210,10,10,0.3)" }}
        >
          <span className="text-[#FF2525] text-xl font-bold">{countdown}</span>
        </div>
        <h2 className="text-white font-bold text-lg mb-2">Still there?</h2>
        <p className="text-white/50 text-sm mb-6">
          You&apos;ll be signed out in{" "}
          <span className="text-white font-semibold">{countdown} second{countdown !== 1 ? "s" : ""}</span>{" "}
          due to inactivity.
        </p>
        <button
          onClick={resetTimers}
          className="w-full py-2.5 rounded-lg font-semibold text-sm text-white transition-all"
          style={{ background: "linear-gradient(135deg, #D20A0A, #FF2525)" }}
        >
          Stay signed in
        </button>
      </div>
    </div>
  );
}
