import { Skeleton } from "@/components/ui/skeleton";

export default function PageSkeleton({ cards = 3, lines = 4, label }: { cards?: number; lines?: number; label: string }) {
  return (
    <div className="mx-auto max-w-5xl" aria-busy="true" aria-label={label} role="status">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="mt-3 h-4 w-64 max-w-full" />
      <div className="mt-8 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: cards }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton key={index} className="h-16 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
