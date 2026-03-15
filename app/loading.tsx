import { EventCardSkeleton } from "@/components/ui/Skeleton";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      {/* Hero skeleton */}
      <div className="mb-12 text-center space-y-4">
        <Skeleton className="h-6 w-40 rounded-full mx-auto" />
        <Skeleton className="h-14 w-72 mx-auto" />
        <Skeleton className="h-5 w-80 mx-auto" />
      </div>
      {/* Featured card */}
      <div className="mb-8">
        <EventCardSkeleton />
      </div>
      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <EventCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
