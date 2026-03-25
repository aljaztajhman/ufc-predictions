"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, UserPlus, ArrowLeft, Check, X } from "lucide-react";

// ── Password strength ─────────────────────────────────────────────────────────
function getStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score, label: "Weak",   color: "#ef4444" };
  if (score <= 2) return { score, label: "Fair",   color: "#f97316" };
  if (score <= 3) return { score, label: "Good",   color: "#eab308" };
  return           { score, label: "Strong", color: "#22c55e" };
}

function Rule({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs transition-colors ${ok ? "text-green-400" : "text-white/30"}`}>
      {ok ? <Check size={10} /> : <X size={10} />}
      {text}
    </li>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "", confirmPassword: "" });
  const [showPw, setShowPw]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);

  const strength = getStrength(form.password);
  const pwMatch  = form.confirmPassword.length > 0 && form.password === form.confirmPassword;

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Client-side pre-check
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      // 1. Register
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed");
        setLoading(false);
        return;
      }

      // 2. Auto sign-in after successful registration
      const signInResult = await signIn("credentials", {
        username: form.username.trim(),
        password: form.password,
        redirect: false,
      });

      if (signInResult?.error) {
        // Account created but sign-in failed — send to login
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
          <p className="text-white/40 text-sm mt-1">Create your account</p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-8">
          <h2 className="text-white font-semibold text-lg mb-6">Register</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                Username
              </label>
              <input
                type="text"
                autoComplete="username"
                required
                value={form.username}
                onChange={(e) => update("username", e.target.value)}
                placeholder="3–20 characters"
                className="bg-white/[0.06] border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#D20A0A] focus:bg-white/[0.08] transition-all"
              />
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="you@example.com"
                className="bg-white/[0.06] border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#D20A0A] focus:bg-white/[0.08] transition-all"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-3 pr-11 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#D20A0A] focus:bg-white/[0.08] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Strength bar */}
              {form.password.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="h-1 flex-1 rounded-full transition-all duration-300"
                        style={{
                          background: i <= strength.score ? strength.color : "rgba(255,255,255,0.08)",
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs" style={{ color: strength.color }}>
                    {strength.label}
                  </span>
                </div>
              )}

              {/* Rules */}
              {form.password.length > 0 && (
                <ul className="flex flex-col gap-1 mt-1">
                  <Rule ok={form.password.length >= 8} text="At least 8 characters" />
                  <Rule ok={/[A-Z]/.test(form.password)} text="One uppercase letter" />
                  <Rule ok={/[0-9]/.test(form.password)} text="One number" />
                </ul>
              )}
            </div>

            {/* Confirm password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={form.confirmPassword}
                  onChange={(e) => update("confirmPassword", e.target.value)}
                  placeholder="Repeat password"
                  className={`w-full bg-white/[0.06] border rounded-lg px-4 py-3 pr-11 text-white text-sm placeholder:text-white/25 focus:outline-none focus:bg-white/[0.08] transition-all ${
                    form.confirmPassword.length > 0
                      ? pwMatch
                        ? "border-green-500/50 focus:border-green-500"
                        : "border-red-500/50 focus:border-red-500"
                      : "border-white/10 focus:border-[#D20A0A]"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
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

            {/* Error */}
            {error && (
              <p className="text-[#FF2525] text-sm bg-[#FF2525]/10 border border-[#FF2525]/20 rounded-lg px-4 py-2.5">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-lg font-semibold text-sm text-white mt-1 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #D20A0A, #FF2525)" }}
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <UserPlus size={15} />
              )}
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>
        </div>

        {/* Back to login */}
        <div className="flex justify-center mt-5">
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-white/35 hover:text-white/60 text-sm transition-colors"
          >
            <ArrowLeft size={13} />
            Back to sign in
          </Link>
        </div>

        <p className="text-center text-white/15 text-xs mt-4">
          For entertainment only — not financial or betting advice.
        </p>
      </div>
    </div>
  );
}
