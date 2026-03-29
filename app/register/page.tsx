"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Eye, EyeOff, UserPlus, ArrowLeft, Check, X,
  CreditCard, Key, ChevronRight, Loader2,
} from "lucide-react";

// ── Password strength ─────────────────────────────────────────────────────────
function getStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8)          score++;
  if (pw.length >= 12)         score++;
  if (/[A-Z]/.test(pw))        score++;
  if (/[0-9]/.test(pw))        score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score, label: "Weak",   color: "#ef4444" };
  if (score <= 2) return { score, label: "Fair",   color: "#f97316" };
  if (score <= 3) return { score, label: "Good",   color: "#eab308" };
  return                { score, label: "Strong", color: "#22c55e" };
}

function Rule({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs transition-colors ${ok ? "text-green-400" : "text-white/40"}`}>
      {ok ? <Check size={11} /> : <X size={11} />}
      {text}
    </li>
  );
}

// ── Shared account fields ─────────────────────────────────────────────────────
interface AccountFields {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}
function AccountForm({
  form, onChange, showPw, showConfirm, setShowPw, setShowConfirm,
}: {
  form: AccountFields;
  onChange: (field: keyof AccountFields, value: string) => void;
  showPw: boolean;
  showConfirm: boolean;
  setShowPw: (v: boolean) => void;
  setShowConfirm: (v: boolean) => void;
}) {
  const strength = getStrength(form.password);
  const pwMatch  = form.confirmPassword.length > 0 && form.password === form.confirmPassword;

  return (
    <>
      {/* Username */}
      <div className="flex flex-col gap-1.5">
        <label className="text-white/65 text-xs font-medium uppercase tracking-wider">Username</label>
        <input
          type="text"
          autoComplete="username"
          required
          value={form.username}
          onChange={(e) => onChange("username", e.target.value)}
          placeholder="3–20 characters"
          className="bg-white/[0.06] border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#D20A0A] focus:bg-white/[0.08] transition-all"
        />
      </div>

      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <label className="text-white/65 text-xs font-medium uppercase tracking-wider">Email</label>
        <input
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(e) => onChange("email", e.target.value)}
          placeholder="you@example.com"
          className="bg-white/[0.06] border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#D20A0A] focus:bg-white/[0.08] transition-all"
        />
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <label className="text-white/65 text-xs font-medium uppercase tracking-wider">Password</label>
        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            autoComplete="new-password"
            required
            value={form.password}
            onChange={(e) => onChange("password", e.target.value)}
            placeholder="Min. 8 characters"
            className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-3 pr-11 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#D20A0A] focus:bg-white/[0.08] transition-all"
          />
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
          >
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {form.password.length > 0 && (
          <>
            <div className="flex gap-1 mt-0.5">
              {[1,2,3,4,5].map((i) => (
                <div
                  key={i}
                  className="h-1 flex-1 rounded-full transition-all duration-300"
                  style={{ background: i <= strength.score ? strength.color : "rgba(255,255,255,0.08)" }}
                />
              ))}
            </div>
            <span className="text-xs" style={{ color: strength.color }}>{strength.label}</span>
            <ul className="flex flex-col gap-1">
              <Rule ok={form.password.length >= 8} text="At least 8 characters" />
              <Rule ok={/[A-Z]/.test(form.password)} text="One uppercase letter" />
              <Rule ok={/[0-9]/.test(form.password)} text="One number" />
            </ul>
          </>
        )}
      </div>

      {/* Confirm password */}
      <div className="flex flex-col gap-1.5">
        <label className="text-white/65 text-xs font-medium uppercase tracking-wider">Confirm Password</label>
        <div className="relative">
          <input
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            required
            value={form.confirmPassword}
            onChange={(e) => onChange("confirmPassword", e.target.value)}
            placeholder="Repeat password"
            className={`w-full bg-white/[0.06] border rounded-lg px-4 py-3 pr-11 text-white text-sm placeholder:text-white/30 focus:outline-none focus:bg-white/[0.08] transition-all ${
              form.confirmPassword.length > 0
                ? pwMatch
                  ? "border-green-500/50 focus:border-green-500"
                  : "border-red-500/50 focus:border-red-500"
                : "border-white/10 focus:border-[#D20A0A]"
            }`}
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
          >
            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {form.confirmPassword.length > 0 && (
          <p className={`text-xs ${pwMatch ? "text-green-400" : "text-red-400"}`}>
            {pwMatch ? "Passwords match" : "Passwords do not match"}
          </p>
        )}
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main page
// ══════════════════════════════════════════════════════════════════════════════
type Mode = "choose" | "stripe" | "invite";

const EMPTY: AccountFields = { username: "", email: "", password: "", confirmPassword: "" };

export default function RegisterPage() {
  const router = useRouter();
  const [mode, setMode]           = useState<Mode>("choose");
  const [form, setForm]           = useState<AccountFields>(EMPTY);
  const [inviteCode, setInviteCode] = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);

  function update(field: keyof AccountFields, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setError(null);
  }

  // ── Stripe path ─────────────────────────────────────────────────────────────
  async function handleStripe(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match"); return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "register", ...form }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to start checkout"); setLoading(false); return; }
      window.location.href = data.url; // Redirect to Stripe
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  // ── Invite code path ─────────────────────────────────────────────────────────
  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match"); return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, inviteCode }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Registration failed"); setLoading(false); return; }

      // Auto sign-in
      const signInResult = await signIn("credentials", {
        username: form.username.trim(),
        password: form.password,
        redirect: false,
      });
      if (signInResult?.error) {
        router.push("/login?registered=1");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  // ── Choose screen ────────────────────────────────────────────────────────────
  const chooseScreen = (
    <div className="flex flex-col gap-4">
      {/* Subscribe option */}
      <button
        onClick={() => setMode("stripe")}
        className="group relative bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 hover:border-[#D20A0A]/50 rounded-2xl p-5 text-left transition-all"
      >
        <div className="flex items-start gap-4">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: "linear-gradient(135deg, #D20A0A22, #FF252222)", border: "1px solid #D20A0A44" }}
          >
            <CreditCard size={20} className="text-[#FF2525]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-white font-semibold text-base">Subscribe</span>
              <span className="bg-[#D20A0A]/20 text-[#FF4444] text-xs font-semibold px-2 py-0.5 rounded-full border border-[#D20A0A]/30">
                €20 / month
              </span>
            </div>
            <p className="text-white/55 text-sm leading-relaxed">
              Full access to AI predictions, accumulator builder, and fight analytics. Cancel anytime.
            </p>
            <ul className="mt-3 flex flex-col gap-1.5">
              {["AI fight predictions", "Accumulator slip builder", "Real-time odds integration"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-white/65 text-xs">
                  <Check size={11} className="text-green-400 shrink-0" />{f}
                </li>
              ))}
            </ul>
          </div>
          <ChevronRight size={16} className="text-white/25 group-hover:text-white/55 transition-colors shrink-0 mt-1" />
        </div>
      </button>

      {/* Invite code option */}
      <button
        onClick={() => setMode("invite")}
        className="group relative bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 hover:border-amber-500/40 rounded-2xl p-5 text-left transition-all"
      >
        <div className="flex items-start gap-4">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)" }}
          >
            <Key size={20} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-white font-semibold text-base">Invite Code</span>
              <span className="bg-amber-500/15 text-amber-400 text-xs font-semibold px-2 py-0.5 rounded-full border border-amber-500/25">
                Lifetime Access
              </span>
            </div>
            <p className="text-white/55 text-sm leading-relaxed">
              Have an invite code? Register with it for lifetime access — no subscription required.
            </p>
          </div>
          <ChevronRight size={16} className="text-white/25 group-hover:text-white/55 transition-colors shrink-0 mt-1" />
        </div>
      </button>
    </div>
  );

  // ── Stripe form ──────────────────────────────────────────────────────────────
  const stripeForm = (
    <form onSubmit={handleStripe} className="flex flex-col gap-4">
      <div className="flex items-center gap-3 mb-2 pb-4 border-b border-white/8">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #D20A0A22, #FF252222)", border: "1px solid #D20A0A44" }}
        >
          <CreditCard size={15} className="text-[#FF2525]" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm">Monthly Subscription</p>
          <p className="text-white/55 text-xs">€20/month — you&apos;ll complete payment on Stripe</p>
        </div>
      </div>

      <AccountForm
        form={form} onChange={update}
        showPw={showPw} showConfirm={showConfirm}
        setShowPw={setShowPw} setShowConfirm={setShowConfirm}
      />

      {error && (
        <p className="text-[#FF4444] text-sm bg-[#FF2525]/10 border border-[#FF2525]/20 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm text-white mt-1 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: "linear-gradient(135deg, #D20A0A, #FF2525)" }}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
        {loading ? "Redirecting to Stripe…" : "Continue to Payment"}
      </button>

      <p className="text-white/40 text-xs text-center">
        Secure checkout via Stripe — we never store card details.
      </p>
    </form>
  );

  // ── Invite form ──────────────────────────────────────────────────────────────
  const inviteForm = (
    <form onSubmit={handleInvite} className="flex flex-col gap-4">
      <div className="flex items-center gap-3 mb-2 pb-4 border-b border-white/8">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)" }}
        >
          <Key size={15} className="text-amber-400" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm">Invite Code Registration</p>
          <p className="text-white/55 text-xs">Grants lifetime access — one use per code</p>
        </div>
      </div>

      <AccountForm
        form={form} onChange={update}
        showPw={showPw} showConfirm={showConfirm}
        setShowPw={setShowPw} setShowConfirm={setShowConfirm}
      />

      {/* Invite code field */}
      <div className="flex flex-col gap-1.5">
        <label className="text-white/65 text-xs font-medium uppercase tracking-wider">Invite Code</label>
        <input
          type="text"
          required
          value={inviteCode}
          onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setError(null); }}
          placeholder="e.g. UFC-A1B2C3"
          className="bg-amber-500/[0.06] border border-amber-500/20 rounded-lg px-4 py-3 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-amber-400/60 focus:bg-amber-500/[0.09] transition-all font-mono tracking-widest uppercase"
        />
      </div>

      {error && (
        <p className="text-[#FF4444] text-sm bg-[#FF2525]/10 border border-[#FF2525]/20 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm text-white mt-1 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: "linear-gradient(135deg, #92400e, #d97706)" }}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
        {loading ? "Creating account…" : "Create Account"}
      </button>
    </form>
  );

  // ── Layout ───────────────────────────────────────────────────────────────────
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

      <div className="relative z-10 w-full max-w-sm py-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #D20A0A, #FF2525)" }}
          >
            <span className="text-white text-xl font-black">U</span>
          </div>
          <h1 className="text-white text-2xl font-black tracking-tight">UFC PREDICTIONS</h1>
          <p className="text-white/55 text-sm mt-1">
            {mode === "choose" ? "Create your account" : mode === "stripe" ? "Monthly subscription" : "Register with invite code"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-7">
          {/* Card header with back button when in sub-mode */}
          {mode !== "choose" && (
            <button
              type="button"
              onClick={() => { setMode("choose"); setError(null); }}
              className="flex items-center gap-1.5 text-white/50 hover:text-white/80 text-sm mb-5 transition-colors"
            >
              <ArrowLeft size={14} />
              Back
            </button>
          )}

          {mode === "choose" && (
            <h2 className="text-white font-semibold text-lg mb-5">Get Access</h2>
          )}

          {mode === "choose" && chooseScreen}
          {mode === "stripe"  && stripeForm}
          {mode === "invite"  && inviteForm}
        </div>

        {/* Back to login */}
        <div className="flex justify-center mt-5">
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-white/40 hover:text-white/65 text-sm transition-colors"
          >
            <ArrowLeft size={13} />
            Back to sign in
          </Link>
        </div>

        <p className="text-center text-white/20 text-xs mt-4">
          For entertainment only — not financial or betting advice.
        </p>
      </div>
    </div>
  );
}
