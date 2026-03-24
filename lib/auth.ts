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
            SELECT id, username, password_hash, email, role
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
          id: String(user.id),
          name: user.username as string,
          email: (user.email as string) ?? null,
          role: user.role as string,
        };
      },
    }),
  ],
  callbacks: {
    authorized: authConfig.callbacks!.authorized,
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
});
