import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="relative mb-6">
        <div className="w-20 h-20 bg-ufc-red/10 border border-ufc-red/20 rounded-2xl flex items-center justify-center mx-auto">
          <Shield size={32} className="text-ufc-red/60" />
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 bg-[#0A0A0A] border border-white/10 rounded-lg flex items-center justify-center">
          <span className="text-white/40 font-black text-sm">?</span>
        </div>
      </div>
      <h1 className="text-4xl font-black uppercase text-white mb-2">404</h1>
      <p className="text-white/60 text-lg mb-1">This fight card doesn&apos;t exist</p>
      <p className="text-white/70 text-sm mb-8 max-w-xs">
        The event or page you&apos;re looking for couldn&apos;t be found.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 bg-ufc-red text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-ufc-red-dark transition-colors"
      >
        <ArrowLeft size={15} />
        Back to Events
      </Link>
    </div>
  );
}
