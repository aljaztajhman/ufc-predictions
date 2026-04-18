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
    async jwt({ token, user, trigger }) {
      // On sign-in: copy provider values into the token
      if (user) {
        token.id                    = user.id;
        token.role                  = (user as any).role;
        token.subscriptionStatus    = (user as any).subscriptionStatus ?? "free";
        token.subscriptionExpiresAt = (user as any).subscriptionExpiresAt ?? null;
      }

      // On explicit session.update() (called by client polling after Stripe
      // checkout): re-read the subscription fields from the DB so the JWT
      // picks up the row the webhook just updated. Without this, the old
      // "pending" JWT claim persists for 30 min and middleware keeps
      // redirecting the user back to /subscribe even though they paid.
      if (trigger === "update" && token.id) {
        try {
          const rows = await sql`
            SELECT subscription_status, subscription_expires_at
            FROM users
            WHERE id = ${token.id as string}
            LIMIT 1
          `;
          const row = rows[0];
          if (row) {
            token.subscriptionStatus    = (row.subscription_status as string) ?? "free";
            token.subscriptionExpiresAt = row.subscription_expires_at
              ? new Date(row.subscription_expires_at as string).toISOString()
              : null;
          }
        } catch (err) {
          console.error("[auth] JWT refresh query failed:", err);
          // keep the stale token rather than logging the user out
        }
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
