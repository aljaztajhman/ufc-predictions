"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <AlertTriangle size={28} className="text-amber-500/60" />
      </div>
      <h2 className="text-2xl font-black uppercase text-white mb-2">Something went wrong</h2>
      <p className="text-white/70 text-sm mb-1 max-w-sm">
        {error.message || "An unexpected error occurred while loading this page."}
      </p>
      {error.digest && (
        <p className="text-white/60 text-xs mb-6 font-mono">Error ID: {error.digest}</p>
      )}
      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 bg-white/8 text-white/70 font-medium px-4 py-2 rounded-lg hover:bg-white/12 transition-colors text-sm"
        >
          <RefreshCw size={13} />
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-ufc-red/10 text-ufc-red font-medium px-4 py-2 rounded-lg hover:bg-ufc-red/15 transition-colors text-sm border border-ufc-red/20"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
