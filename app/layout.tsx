import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/ui/Navbar";
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

        <Navbar />

        <main className="relative z-10 pt-14">
          {children}
        </main>

        <footer className="relative z-10 mt-24 border-t border-white/5 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-md flex items-center justify-center"
                   style={{ background: "linear-gradient(135deg, #D20A0A, #FF2525)" }}>
                <span className="text-white text-xs font-black">U</span>
              </div>
              <span className="text-white/35 text-sm font-medium">UFC Predictions</span>
            </div>
            <p className="text-white/20 text-xs text-center">
              For entertainment only. Predictions powered by AI — not financial or betting advice.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
