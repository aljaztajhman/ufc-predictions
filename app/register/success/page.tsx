"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, ArrowRight, AlertCircle } from "lucide-react";

// ── Inner component (needs useSearchParams inside Suspense) ───────────────────
function SuccessContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const username     = searchParams.get("username") ?? "";

  const [status, setStatus] = useState<"signing-in" | "done" | "error">("signing-in");
  const [countdown, setCountdown] = useState(5);

  // Stripe just redirected here — the webhook should have activated the user.
  // We don't have the password here so we can't auto-sign-in; just show a
  // success message and send them to /login.
  useEffect(() => {
    setStatus("done");
  }, []);

  useEffect(() => {
    if (status !== "done") return;
    if (countdown <= 0) {
      router.push("/login?registered=1");
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [status, countdown, router]);

  return (
    <div className="flex flex-col items-center text-center gap-6">
      {status === "signing-in" ? (
        <>
          <Loader2 size={48} className="animate-spin text-[#FF2525]" />
          <div>
            <h2 className="text-white text-xl font-bold mb-2">Setting up your account…</h2>
            <p className="text-white/55 text-sm">Just a moment while we activate your subscription.</p>
          </div>
        </>
      ) : status === "done" ? (
        <>
          {/* Success icon */}
          <div className="relative">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))", border: "1px solid rgba(34,197,94,0.3)" }}
            >
              <CheckCircle2 size={40} className="text-green-400" />
            </div>
            {/* Pulse ring */}
            <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: "rgba(34,197,94,0.3)" }} />
          </div>

          <div>
            <h2 className="text-white text-2xl font-black mb-2 tracking-tight">
              Welcome{username ? `, ${username}` : ""}! 🎉
            </h2>
            <p className="text-white/65 text-sm leading-relaxed max-w-xs mx-auto">
              Your subscription is active. You now have full access to AI fight predictions and the accumulator builder.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2">
            {["AI Predictions", "Accumulator Builder", "Live Odds", "Lifetime Updates"].map((f) => (
              <span
                key={f}
                className="text-xs font-medium px-3 py-1.5 rounded-full text-green-300 border border-green-500/25"
                style={{ background: "rgba(34,197,94,0.08)" }}
              >
                {f}
              </span>
            ))}
          </div>

          <div className="w-full flex flex-col gap-3 mt-2">
            <Link
              href="/login?registered=1"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-all"
              style={{ background: "linear-gradient(135deg, #D20A0A, #FF2525)" }}
            >
              Sign in to your account
              <ArrowRight size={16} />
            </Link>
            <p className="text-white/35 text-xs">
              Redirecting to sign-in in {countdown}s…
            </p>
          </div>
        </>
      ) : (
        <>
          <AlertCircle size={48} className="text-amber-400" />
          <div>
            <h2 className="text-white text-xl font-bold mb-2">Almost there!</h2>
            <p className="text-white/55 text-sm leading-relaxed max-w-xs mx-auto">
              Your payment was received. It may take a moment to activate your account — please sign in and if access isn&apos;t available yet, wait a minute and try again.
            </p>
          </div>
          <Link
            href="/login?registered=1"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-all"
            style={{ background: "linear-gradient(135deg, #D20A0A, #FF2525)" }}
          >
            Go to sign in
            <ArrowRight size={16} />
          </Link>
        </>
      )}
    </div>
  );
}

// ── Page wrapper ──────────────────────────────────────────────────────────────
export default function RegisterSuccessPage() {
  return (
    <div className="min-h-screen bg-[#0D0F18] flex flex-col items-center justify-center px-4 relative">
      {/* Background grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)
          `,
          backgroundSize: "56px 56px",
        }}
      />

      {/* Subtle green glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] pointer-events-none opacity-15"
        style={{ background: "radial-gradient(ellipse at center, rgba(34,197,94,0.4) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #D20A0A, #FF2525)" }}
          >
            <span className="text-white text-xl font-black">U</span>
          </div>
          <h1 className="text-white text-2xl font-black tracking-tight">UFC PREDICTIONS</h1>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-8">
          <Suspense fallback={
            <div className="flex flex-col items-center gap-4 py-4">
              <Loader2 size={36} className="animate-spin text-white/40" />
              <p className="text-white/55 text-sm">Loading…</p>
            </div>
          }>
            <SuccessContent />
          </Suspense>
        </div>

        <p className="text-center text-white/20 text-xs mt-5">
          For entertainment only — not financial or betting advice.
        </p>
      </div>
    </div>
  );
}