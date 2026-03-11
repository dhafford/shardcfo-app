import { Skeleton } from "@/components/ui/skeleton";

export function KpiCardSkeleton() {
  return (
    <div className="border rounded-xl p-4 bg-white">
      <Skeleton className="h-3 w-20 mb-2" />
      <Skeleton className="h-8 w-28 mb-3" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function KpiGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <KpiCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="bg-slate-50 px-4 py-3 border-b flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-24" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-b flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 w-20" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="border rounded-xl p-6 bg-white">
      <Skeleton className="h-5 w-40 mb-6" />
      <Skeleton className="h-[300px] w-full rounded-lg" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>
      <KpiGridSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  );
}
