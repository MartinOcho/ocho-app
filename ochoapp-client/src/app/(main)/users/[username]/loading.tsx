import { PostLoadingSkeleton } from "@/components/posts/PostsLoadingSkeleton";
import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex h-fit w-full min-w-0 gap-5 max-sm:py-4">
      <PostLoadingSkeleton />
      <div className="sticky top-0 hidden h-fit w-80 flex-none lg:block">
        <Loader2 className="mx-auto my-3 animate-spin" />
      </div>
    </div>
  );
}
