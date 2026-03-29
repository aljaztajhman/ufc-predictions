"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, LogIn, UserPlus, KeyRound } from "lucide-react";
import { Suspense } from "react";

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const registered   = searchParams.get("registered") === "1";
  const renewed      = searchParams.get("renewed") === "1";

  const [username, setUsername]       = useState("");
  const [password, setPassword]       = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        username: username.trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid username or password.");
        setLoading(false);
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
          <p className="text-white/55 text-sm mt-1">AI-powered fight analysis</p>
        </div>

        {/* Success banner */}
        {(registered || renewed) && (
          <div className="mb-5 rounded-xl px-4 py-3.5 border border-green-500/25 bg-green-500/8">
            <p className="text-green-400 text-sm font-semibold">
              {renewed ? "Subscription renewed!" : "Account created!"} Sign in below.
            </p>
          </div>
        )}

        {/* Card */}
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-8">
          <h2 className="text-white font-semibold text-lg mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label className="text-white/65 text-xs font-medium uppercase tracking-wider">
                Username
              </label>
              <input
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="bg-white/[0.06] border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#D20A0A] focus:bg-white/[0.08] transition-all"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-white/65 text-xs font-medium uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-3 pr-11 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#D20A0A] focus:bg-white/[0.08] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <p className="text-[#FF4444] text-sm bg-[#FF2525]/10 border border-[#FF2525]/20 rounded-lg px-4 py-2.5">
                {error}
              </p>
            )}

            {/* Forgot password — placeholder */}
            <div className="flex justify-end -mt-1">
              <button
                type="button"
                disabled
                title="Coming soon"
                className="flex items-center gap-1.5 text-white/40 text-xs cursor-not-allowed select-none"
              >
                <KeyRound size={11} />
                Forgot password?
                <span className="text-white/25 text-xs ml-1">(coming soon)</span>
              </button>
            </div>

            {/* Sign In */}
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-lg font-semibold text-sm text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #D20A0A, #FF2525)" }}
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn size={15} />
              )}
              {loading ? "Signing in…" : "Sign In"}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-white/8" />
              <span className="text-white/35 text-xs">or</span>
              <div className="flex-1 h-px bg-white/8" />
            </div>

            {/* Register */}
            <Link
              href="/register"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-lg border border-white/10 text-white/70 text-sm font-medium hover:bg-white/[0.06] hover:text-white transition-all"
            >
              <UserPlus size={15} />
              Create Account
            </Link>
          </form>
        </div>

        <p className="text-center text-white/25 text-xs mt-6">
          For entertainment only — not financial or betting advice.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
