import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/ui/Providers";
import { ClientLayout } from "@/components/ui/ClientLayout";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const viewport: Viewport = {
  themeColor: "#0D0F18",
};

export const metadata: Metadata = {
  title: {
    default: "UFC Predictions — AI-Powered Fight Analysis",
    template: "%s | UFC Predictions",
  },
  description:
    "AI-powered UFC fight predictions with detailed fighter stats, matchup breakdowns, and confidence ratings.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    type: "website",
    title: "UFC Predictions",
    description: "AI-powered UFC fight predictions",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={cn(inter.variable, "min-h-screen bg-[#0D0F18] text-white antialiased")}>
        {/* Subtle background grid */}
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
        <Providers>
          <ClientLayout>{children}</ClientLayout>
        </Providers>
      </body>
    </html>
  );
}
