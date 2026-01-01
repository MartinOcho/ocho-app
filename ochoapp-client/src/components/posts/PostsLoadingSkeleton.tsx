import { Skeleton } from "../ui/skeleton";

export default function PostsLoadingSkeleton() {
  return (
    <div className="space-y-2 max-sm:py-2 sm:space-y-5">
      <PostLoadingSkeleton />
      <PostLoadingSkeleton />
      <PostLoadingSkeleton />
    </div>
  );
}

export function PostLoadingSkeleton() {
  return (
    <div className="w-full max-w-lg animate-pulse space-y-3 bg-card/50 p-5 shadow-sm sm:rounded-lg sm:bg-card">
      <div className="flex flex-wrap gap-3">
        <Skeleton className="size-12 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-4 w-20 rounded" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-[90%] rounded" />
        <Skeleton className="h-4 w-[60%] rounded" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="aspect-square rounded-2xl" />
        <Skeleton className="aspect-square rounded-2xl" />
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-6 w-12 rounded" />
        <Skeleton className="h-6 w-6 rounded" />
      </div>
    </div>
  );
}
