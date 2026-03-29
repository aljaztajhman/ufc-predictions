"use client";

import { SessionProvider } from "next-auth/react";
import { SlipProvider } from "@/contexts/SlipContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SlipProvider>
        {children}
      </SlipProvider>
    </SessionProvider>
  );
}
