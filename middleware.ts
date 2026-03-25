/**
 * Auth middleware — protects all routes using the edge-compatible auth config.
 * Only checks the JWT token — no DB calls here.
 */

import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Protect everything except Next.js internals and static assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)"],
};
