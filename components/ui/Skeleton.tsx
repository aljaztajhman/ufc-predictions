import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} />;
}

export function EventCardSkeleton() {
  return (
    <div className="bg-ufc-dark-2 border border-white/6 rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-start">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-7 w-48" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="border-t border-white/5 pt-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-6 w-28" />
        </div>
      </div>
    </div>
  );
}

export function FightCardSkeleton() {
  return (
    <div className="bg-ufc-dark-2 border border-white/6 rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="flex items-center gap-4">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}

export function PredictionSkeleton() {
  return (
    <div className="space-y-4 p-4 bg-black/20 rounded-xl border border-white/5">
      <div className="flex items-center gap-3">
        <Skeleton className="w-20 h-20 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
  );
}
