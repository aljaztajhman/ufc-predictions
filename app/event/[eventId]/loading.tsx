import { FightCardSkeleton } from "@/components/ui/Skeleton";
import { Skeleton } from "@/components/ui/Skeleton";

export default function EventLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      <Skeleton className="h-4 w-20 rounded" />
      <div className="space-y-2">
        <Skeleton className="h-10 w-56 rounded" />
        <Skeleton className="h-4 w-72 rounded" />
      </div>
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="space-y-3 pt-4">
        <Skeleton className="h-5 w-28 rounded" />
        {[...Array(5)].map((_, i) => (
          <FightCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
