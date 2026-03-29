/**
 * Edge-compatible auth config.
 * Used by middleware — must NOT import bcrypt, pg, or any Node.js-only module.
 * Full config (with DB + bcrypt) lives in lib/auth.ts.
 */

import type { NextAuthConfig } from "next-auth";

// Routes that require an active subscription (in addition to being logged in)
const SUBSCRIPTION_PATHS = [
  "/event/",
  "/api/prediction",
  "/api/predictions",
  "/api/event/",
];

function requiresSubscription(pathname: string): boolean {
  return SUBSCRIPTION_PATHS.some((p) => pathname.startsWith(p));
}

function hasActiveSubscription(user: any): boolean {
  const status     = user?.subscriptionStatus as string | undefined;
  const expiresAt  = user?.subscriptionExpiresAt as string | null | undefined;
  const role       = user?.role as string | undefined;

  if (role === "admin") return true;
  if (status === "lifetime") return true;
  if (status === "active") {
    if (!expiresAt) return true;
    return new Date(expiresAt) > new Date();
  }
  return false;
}

export const authConfig = {
  session: { strategy: "jwt" as const },
  pages: { signIn: "/login" },
  callbacks: {
    // Map JWT token fields → session.user so middleware can read them
    session({ session, token }: any) {
      if (session.user) {
        session.user.id                    = token.id;
        session.user.role                  = token.role;
        session.user.subscriptionStatus    = token.subscriptionStatus ?? "free";
        session.user.subscriptionExpiresAt = token.subscriptionExpiresAt ?? null;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      // Always allow NextAuth's own API routes
      if (pathname.startsWith("/api/auth")) return true;

      // Allow cron + admin endpoints (protected by their own secrets)
      if (pathname.startsWith("/api/cron")) return true;
      if (pathname.startsWith("/api/admin")) return true;

      // Allow public API routes
      if (pathname === "/api/events" || pathname.startsWith("/api/odds")) return true;

      // Allow Stripe routes (checkout needs unauthenticated access for registration,
      // webhook is called by Stripe servers with no session)
      if (pathname.startsWith("/api/stripe")) return true;

      // Auth pages: allow unauthenticated, redirect logged-in users home
      if (pathname === "/login" || pathname === "/register") {
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true;
      }

      // Subscribe page: always allow logged-in users (they need to see it)
      if (pathname === "/subscribe") return isLoggedIn
        ? true
        : Response.redirect(new URL("/login", nextUrl));

      // Register success page: public (Stripe redirects here before login)
      if (pathname === "/register/success") return true;

      // Everything else requires login
      if (!isLoggedIn) return false;

      // Subscription-gated routes — check active subscription
      if (requiresSubscription(pathname)) {
        if (!hasActiveSubscription(auth.user)) {
          return Response.redirect(new URL("/subscribe", nextUrl));
        }
      }

      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
