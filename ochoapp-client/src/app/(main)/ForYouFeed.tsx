"use client";

import InfiniteScrollContainer from "@/components/InfiniteScrollContainer";
import Post from "@/components/posts/Post";
import PostsLoadingSkeleton, {
  PostLoadingSkeleton,
} from "@/components/posts/PostsLoadingSkeleton";
import { t } from "@/context/LanguageContext";
import kyInstance from "@/lib/ky";
import { PostsPage } from "@/lib/types";
import { VocabularyKey } from "@/lib/vocabulary";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Frown, Loader2, PackageOpen } from "lucide-react";

export default function ForYouFeed() {
  const viewedPosts: string[] = [];

  const vocabulary: VocabularyKey[] = ["noPostOnForYou", "dataError"];

  const { noPostOnForYou, dataError } = t(vocabulary);

  const {
    data,
    fetchNextPage,
    isFetching,
    hasNextPage,
    isLoadingError,
    isFetchingNextPage,
    isFetchNextPageError,
    status,
  } = useInfiniteQuery({
    queryKey: ["post-feed", "for-you"],
    queryFn: ({ pageParam }) =>
      kyInstance
        .get(
          "/api/posts/for-you",
          pageParam ? { searchParams: { cursor: pageParam } } : {},
        )
        .json<PostsPage>(),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    throwOnError: false,
  });

  const posts = data?.pages.flatMap((page) => page.posts) || [];

  if (status === "pending") {
    return <PostsLoadingSkeleton />;
  }

  if (status === "success" && !posts.length && !hasNextPage) {
    return (
      <div className="my-8 flex w-full flex-col items-center gap-2 text-center text-muted-foreground">
        <PackageOpen size={150} />
        <h2 className="text-xl">{noPostOnForYou}</h2>
      </div>
    );
  }
  if (isLoadingError) {
    return (
      <div className="my-8 flex w-full flex-col items-center gap-2 text-center text-muted-foreground">
        <Frown size={150} />
        <h2 className="text-xl">{dataError}</h2>
      </div>
    );
  }

  return (
    <InfiniteScrollContainer
      className="flex flex-col gap-2"
      onBottomReached={() => {
        hasNextPage && !isFetchingNextPage && !isFetching && fetchNextPage();
      }}
    >
      {posts.map((post, key) => {
        if (post.id in viewedPosts) {
          return null;
        }
        viewedPosts.push(post.id);
        return <Post key={key} post={post} />;
      })}
      {isFetchNextPageError && (
        <div className="my-8 flex w-full flex-col items-center gap-2 text-center text-muted-foreground">
          <Frown size={150} />
          <h2 className="text-xl">{dataError}</h2>
        </div>
      )}
      {isFetchingNextPage && !isFetchNextPageError && (
        <div className="flex flex-col items-center gap-3 pb-3">
          <PostLoadingSkeleton />
          <Loader2 className="animate-spin" />
        </div>
      )}
    </InfiniteScrollContainer>
  );
}
