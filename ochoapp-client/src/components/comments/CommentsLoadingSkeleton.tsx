import { Skeleton } from "../ui/skeleton";

export default function CommentsLoadingSkeleton() {
  return (
    <div className="divide-y-2 w-full">
      <CommentLoadingSkeleton size="sm" />
      <CommentLoadingSkeleton size="lg" />
      <CommentLoadingSkeleton size="md" />
      <CommentLoadingSkeleton size="xl" />
    </div>
  );
}

interface CommentLoadingSkeletonProps {
  size?: "sm" | "md" | "lg" | "xl";
}

function CommentLoadingSkeleton({ size = "md" }: CommentLoadingSkeletonProps) {
  const sizes = {
    sm: "h-7 w-[60%]",
    md: "h-8 w-[70%]",
    lg: "h-9 w-[90%]",
    xl: "h-10 w-[100%]",
  };
  const sizeClass = sizes[size];
  return (
      <div className="flex gap-3 animate-pulse py-3 px-2 w-full">
        <Skeleton className="hidden size-10 rounded-full sm:inline" />
        <Skeleton className="size-8 rounded-full sm:hidden" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-3 w-28 rounded" />
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className={`rounded ${sizeClass}`} />
        </div>
      </div>
  );
}
