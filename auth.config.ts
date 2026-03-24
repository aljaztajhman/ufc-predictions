/**
 * Edge-compatible auth config.
 * Used by middleware — must NOT import bcrypt, pg, or any Node.js-only module.
 * Full config (with DB + bcrypt) lives in lib/auth.ts.
 */

import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt" as const },
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      // Always allow NextAuth's own API routes
      if (pathname.startsWith("/api/auth")) return true;

      // Allow cron endpoints — protected by their own CRON_SECRET
      if (pathname.startsWith("/api/cron")) return true;

      // Login page: allow unauthenticated, redirect logged-in users to home
      if (pathname === "/login") {
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true;
      }

      // Everything else requires a valid session
      if (!isLoggedIn) return false; // NextAuth redirects to /login
      return true;
    },
  },
  providers: [], // Providers added in lib/auth.ts — not needed here
} satisfies NextAuthConfig;
