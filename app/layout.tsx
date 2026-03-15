import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/ui/Navbar";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

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
  themeColor: "#0A0A0A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={cn(inter.variable, "min-h-screen bg-[#0A0A0A] text-white antialiased")}>
        {/* Background grid */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
          }}
        />
        {/* Red top accent line */}
        <div className="fixed top-0 left-0 right-0 h-[2px] bg-ufc-red z-50" />

        <Navbar />

        <main className="relative z-10 pt-16">
          {children}
        </main>

        <footer className="relative z-10 mt-24 border-t border-white/5 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-ufc-red rounded-sm flex items-center justify-center">
                <span className="text-white text-xs font-black">U</span>
              </div>
              <span className="text-white/40 text-sm">UFC Predictions</span>
            </div>
            <p className="text-white/25 text-xs text-center">
              For entertainment only. Predictions powered by AI — not financial or betting advice.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
