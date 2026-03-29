"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

export default function EventError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-10 transition-colors group"
      >
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
        All Events
      </Link>

      <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
        <AlertTriangle size={24} className="text-amber-500/60" />
      </div>
      <h2 className="text-xl font-black uppercase text-white mb-2">Failed to load event</h2>
      <p className="text-white/60 text-sm mb-6 max-w-xs mx-auto">
        {error.message || "Could not load fight card data. Please try again."}
      </p>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 bg-ufc-red/10 text-ufc-red font-medium px-4 py-2 rounded-lg border border-ufc-red/20 hover:bg-ufc-red/15 transition-colors text-sm"
      >
        <RefreshCw size={13} />
        Retry
      </button>
    </div>
  );
}
