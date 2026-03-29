/**
 * Full NextAuth config — runs server-side only (Node.js runtime).
 * Imports bcryptjs and Neon DB for credential verification.
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: {
    strategy: "jwt",
    maxAge: 30 * 60, // JWT lives 30 min — client-side SessionGuard enforces 5 min idle
  },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!username || !password) return null;

        let rows: any[];
        try {
          rows = await sql`
            SELECT id, username, password_hash, email, role,
                   subscription_status, subscription_expires_at
            FROM users
            WHERE username = ${username}
            LIMIT 1
          `;
        } catch (err) {
          console.error("[auth] DB query failed:", err);
          return null;
        }

        const user = rows[0];
        if (!user) return null;

        const passwordMatch = await bcrypt.compare(password, user.password_hash as string);
        if (!passwordMatch) return null;

        return {
          id:                    String(user.id),
          name:                  user.username as string,
          email:                 (user.email as string) ?? null,
          role:                  user.role as string,
          subscriptionStatus:    (user.subscription_status as string) ?? "free",
          subscriptionExpiresAt: user.subscription_expires_at
            ? new Date(user.subscription_expires_at as string).toISOString()
            : null,
        };
      },
    }),
  ],
  callbacks: {
    authorized: authConfig.callbacks!.authorized,
    jwt({ token, user }) {
      if (user) {
        token.id                    = user.id;
        token.role                  = (user as any).role;
        token.subscriptionStatus    = (user as any).subscriptionStatus ?? "free";
        token.subscriptionExpiresAt = (user as any).subscriptionExpiresAt ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id                    = token.id as string;
        session.user.role                  = token.role as string;
        session.user.subscriptionStatus    = token.subscriptionStatus as string;
        session.user.subscriptionExpiresAt = token.subscriptionExpiresAt as string | null;
      }
      return session;
    },
  },
});

// ─── Subscription check helper (server-side) ──────────────────────────────────

export function isSubscriptionActive(
  status: string,
  expiresAt: string | null
): boolean {
  if (status === "lifetime") return true;
  if (status === "active") {
    if (!expiresAt) return true; // no expiry set → treat as active
    return new Date(expiresAt) > new Date();
  }
  return false;
}
