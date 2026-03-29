"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CreditCard, Loader2, CheckCircle2, Lock, ArrowRight,
  Zap, BarChart3, Target, TrendingUp,
} from "lucide-react";

const FEATURES = [
  { icon: Zap,        label: "AI Fight Predictions",       desc: "Claude-powered analysis on every main-card fight" },
  { icon: Target,     label: "Accumulator Builder",         desc: "Build multi-fight slips with AI-calculated slip scores" },
  { icon: BarChart3,  label: "Live Odds Integration",       desc: "Real-time market data woven into every prediction" },
  { icon: TrendingUp, label: "Fighter Signal Analytics",    desc: "Streak, trajectory, ring rust, and style-matchup data" },
];

export default function SubscribePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const subStatus   = (session?.user as any)?.subscriptionStatus ?? "unknown";
  const isExpired   = subStatus === "expired"   || subStatus === "cancelled";
  const isPending   = subStatus === "pending";
  const isNotSub    = subStatus === "free" || subStatus === "unknown";
  const hasAccess   = subStatus === "lifetime" || subStatus === "active";

  // Already subscribed — send home
  useEffect(() => {
    if (status === "authenticated" && hasAccess) {
      router.replace("/");
    }
  }, [status, hasAccess, router]);

  async function handleSubscribe() {
    if (status !== "authenticated") {
      router.push("/login");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "renew" }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to start checkout"); setLoading(false); return; }
      window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  // ── Status banner copy ───────────────────────────────────────────────────────
  let bannerTitle   = "Subscription Required";
  let bannerSubtitle = "Subscribe to access AI fight predictions.";
  let bannerColor   = "#D20A0A";
  let bannerBg      = "rgba(210,10,10,0.08)";
  let bannerBorder  = "rgba(210,10,10,0.2)";

  if (isPending) {
    bannerTitle    = "Payment Processing";
    bannerSubtitle = "Your payment is being confirmed. This usually takes under a minute.";
    bannerColor    = "#f97316";
    bannerBg       = "rgba(249,115,22,0.08)";
    bannerBorder   = "rgba(249,115,22,0.2)";
  } else if (isExpired) {
    bannerTitle    = "Subscription Expired";
    bannerSubtitle = "Your subscription has ended. Renew below to restore access.";
    bannerColor    = "#FF4444";
    bannerBg       = "rgba(255,68,68,0.08)";
    bannerBorder   = "rgba(255,68,68,0.2)";
  }

  return (
    <div className="min-h-screen bg-[#0D0F18] flex flex-col items-center justify-center px-4 py-12 relative">
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
      {/* Red glow top */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] pointer-events-none opacity-10"
        style={{ background: "radial-gradient(ellipse at center, rgba(210,10,10,0.6) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #D20A0A, #FF2525)" }}
          >
            <span className="text-white text-xl font-black">U</span>
          </div>
          <h1 className="text-white text-2xl font-black tracking-tight">UFC PREDICTIONS</h1>
          <p className="text-white/55 text-sm mt-1">AI-powered fight analysis</p>
        </div>

        {/* Status banner (if logged in and has a status context) */}
        {status === "authenticated" && (
          <div
            className="flex items-start gap-3 rounded-xl px-4 py-3.5 mb-5 border"
            style={{ background: bannerBg, borderColor: bannerBorder }}
          >
            <Lock size={16} style={{ color: bannerColor }} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-sm" style={{ color: bannerColor }}>{bannerTitle}</p>
              <p className="text-white/65 text-xs mt-0.5 leading-relaxed">{bannerSubtitle}</p>
            </div>
          </div>
        )}

        {/* Main card */}
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl overflow-hidden">
          {/* Header */}
          <div
            className="px-7 py-6 border-b border-white/8"
            style={{ background: "linear-gradient(135deg, rgba(210,10,10,0.08), rgba(255,37,37,0.04))" }}
          >
            <div className="flex items-end gap-2 mb-1">
              <span className="text-white text-4xl font-black">€20</span>
              <span className="text-white/55 text-base mb-1.5">/ month</span>
            </div>
            <p className="text-white/65 text-sm">Full access to everything. Cancel anytime.</p>
          </div>

          {/* Features */}
          <div className="px-7 py-5 flex flex-col gap-4">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: "rgba(255,37,37,0.1)", border: "1px solid rgba(255,37,37,0.18)" }}
                >
                  <Icon size={15} className="text-[#FF4444]" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{label}</p>
                  <p className="text-white/50 text-xs mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="px-7 pb-7 flex flex-col gap-3">
            {isPending ? (
              <div className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm text-amber-400 border border-amber-500/25 bg-amber-500/8">
                <Loader2 size={16} className="animate-spin" />
                Waiting for payment confirmation…
              </div>
            ) : (
              <button
                onClick={handleSubscribe}
                disabled={loading || status === "loading"}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #D20A0A, #FF2525)" }}
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CreditCard size={16} />
                )}
                {loading
                  ? "Redirecting to Stripe…"
                  : isExpired
                  ? "Renew Subscription"
                  : "Subscribe Now"}
              </button>
            )}

            {error && (
              <p className="text-[#FF4444] text-sm bg-[#FF2525]/10 border border-[#FF2525]/20 rounded-lg px-4 py-3 text-center">
                {error}
              </p>
            )}

            <p className="text-white/35 text-xs text-center">
              Secure checkout via Stripe. Auto-renews monthly.
            </p>
          </div>
        </div>

        {/* Not logged in? Register link */}
        {status === "unauthenticated" && (
          <div className="mt-5 text-center">
            <p className="text-white/45 text-sm">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-[#FF4444] hover:text-[#FF2525] font-medium transition-colors">
                Register
              </Link>
            </p>
          </div>
        )}

        {/* Invite code mention */}
        <div
          className="mt-4 rounded-xl px-4 py-3.5 border text-center"
          style={{ background: "rgba(251,191,36,0.06)", borderColor: "rgba(251,191,36,0.18)" }}
        >
          <p className="text-amber-400/80 text-xs">
            Have an invite code?{" "}
            <Link href="/register" className="text-amber-400 font-semibold hover:text-amber-300 transition-colors">
              Register with it for lifetime access →
            </Link>
          </p>
        </div>

        <p className="text-center text-white/20 text-xs mt-5">
          For entertainment only — not financial or betting advice.
        </p>
      </div>
    </div>
  );
}
