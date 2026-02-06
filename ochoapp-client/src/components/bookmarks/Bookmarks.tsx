"use client";

import InfiniteScrollContainer from "@/components/InfiniteScrollContainer";
import Post from "@/components/posts/Post";
import PostsLoadingSkeleton from "@/components/posts/PostsLoadingSkeleton";
import { t } from "@/context/LanguageContext";
import kyInstance from "@/lib/ky";
import { PostsPage } from "@/lib/types";
import { VocabularyKey } from "@/lib/vocabulary";
import { useInfiniteQuery } from "@tanstack/react-query";
import { BookmarkIcon, Frown, Loader2 } from "lucide-react";

export default function Bookmarks() {
  const { noBookmark, dataError } = t();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ["post-feed", "bookmarks"],
    queryFn: ({ pageParam }) =>
      kyInstance
        .get(
          "/api/posts/bookmarked",
          pageParam ? { searchParams: { cursor: pageParam } } : {},
        )
        .json<PostsPage>(),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const posts = data?.pages.flatMap((page) => page.posts) || [];

  if (status === "pending") {
    return <PostsLoadingSkeleton />;
  }

  if (status === "success" && !posts.length && !hasNextPage) {
    return (
      <div className="my-8 flex w-full flex-col items-center gap-2 text-center text-muted-foreground">
        <BookmarkIcon size={150} />
        <h2 className="text-xl">{noBookmark}</h2>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="my-8 flex w-full flex-col items-center gap-2 text-center text-muted-foreground">
        <Frown size={150} />
        <h2 className="text-xl">{dataError}</h2>
      </div>
    );
  }

  return (
    <InfiniteScrollContainer
      className="max-sm:pb-24 space-y-2 sm:space-y-5"
      onBottomReached={() => hasNextPage && !isFetching && fetchNextPage()}
    >
      {posts.map((post, key) => (
        <Post key={key} post={post} />
      ))}
      {isFetchingNextPage && <Loader2 className="mx-auto my-3 animate-spin" />}
    </InfiniteScrollContainer>
  );
}
