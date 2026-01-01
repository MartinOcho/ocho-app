import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsSkeleton() {
  return (
    <div className="space-y-2 sm:space-y-5">
      <NotificationSkeleton />
      <NotificationSkeleton />
      <NotificationSkeleton />
      <NotificationSkeleton />
      <NotificationSkeleton />
      <NotificationSkeleton />
    </div>
  );
}

function NotificationSkeleton() {
  return (
    <div>
      <article className="flex gap-3 bg-card/50 p-5 shadow-sm transition-colors hover:bg-card/70 sm:rounded-2xl sm:bg-card">
        <div className="flex w-full gap-2">
          <div className="relative w-fit h-fit">
            <Skeleton className="aspect-square size-12 h-fit flex-none rounded-full" />
            <Skeleton className="absolute -bottom-0.5 -right-0.5 size-6 rounded-full" />
          </div>
          <div className="w-full space-y-1">
            <Skeleton className="h-10 w-full rounded" />
            <Skeleton className="h-4 w-20 rounded" />
          </div>
        </div>
      </article>
    </div>
  );
}
