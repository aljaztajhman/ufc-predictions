import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      subscriptionStatus: string;           // 'free'|'pending'|'active'|'lifetime'|'cancelled'|'expired'
      subscriptionExpiresAt: string | null; // ISO string or null
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    subscriptionStatus: string;
    subscriptionExpiresAt: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    subscriptionStatus: string;
    subscriptionExpiresAt: string | null;
  }
}
