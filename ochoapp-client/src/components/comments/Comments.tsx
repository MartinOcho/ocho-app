"use client";

import { CommentsPage, PostData } from "@/lib/types";
import CommentInput from "./CommentInput";
import { useInfiniteQuery } from "@tanstack/react-query";
import kyInstance from "@/lib/ky";
import CommentsLoadingSkeleton from "./CommentsLoadingSkeleton";
import Comment from "./Comment";
import { Button } from "../ui/button";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "../ui/use-toast";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useProgress } from "@/context/ProgressContext";
import { useTranslation } from "@/context/LanguageContext";
import { useSession } from "@/app/(main)/SessionProvider";

interface CommentsProps {
  post: PostData;
  comment?: string | null;
  onClose: () => void;
}

export default function Comments({
  post,
  comment = null,
  onClose,
}: CommentsProps) {
  const [targetComment, setTargetComment] = useState<string | null>(null);
  const { startNavigation: navigate } = useProgress();
  const touchStartY = useRef<number | null>(null);

  const { t } = useTranslation();
  const { user } = useSession();
  const router = useRouter();

  const {
    showPreviousComments,
    noComments,
    noLongerAvailablecomment,
    dataError,
    comments: commentsText,
    comment: commentText,
    commentsFollowersOnly,
    commentsDisabled,
    close,
  } = t();

  const { toast } = useToast();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ["comments", post.id],
    queryFn: ({ pageParam }) =>
      kyInstance
        .get(`/api/posts/${post.id}/comments`, {
          searchParams: new URLSearchParams({
            cursor: pageParam ? String(pageParam) : "",
            comment: targetComment ? String(targetComment) : "",
          }),
        })
        .json<CommentsPage>(),
    initialPageParam: null as string | null,
    getNextPageParam: (firstPage) => firstPage.previousCursor,
  });

  const comments = data?.pages.flatMap((page) => page.comments) || [];
  const canComment =
    post.commentPolicy === "EVERYONE" ||
    (post.commentPolicy === "FOLLOWERS" &&
      (post.userId === user.id || post.user.followers.length > 0));

  useEffect(() => {
    if (
      status === "success" &&
      comment &&
      !comments.find((c) => c.id === comment)
    ) {
      toast({
        variant: "destructive",
        description: noLongerAvailablecomment,
      });
      navigate(`/posts/${post.id}`);
      onClose();
    }
    if (
      status === "success" &&
      comment &&
      comments.find((c) => c.id === comment)
    ) {
      setTargetComment(comment);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, comment, data, comments]);

  return (
    <div className="group/comments bg-background sm:bg-card relative z-20 flex w-full flex-col overflow-hidden shadow-lg max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-50 max-sm:h-[min(85dvh,720px)] max-sm:rounded-t-2xl sm:h-96 sm:max-h-[70vh]">
      <div
        className="relative flex w-full shrink-0 items-center justify-between border-b px-4 py-3 font-semibold"
        onTouchStart={(event) => {
          touchStartY.current = event.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={(event) => {
          const startY = touchStartY.current;
          touchStartY.current = null;
          const endY = event.changedTouches[0]?.clientY;
          if (startY !== null && endY !== undefined && endY - startY > 80) {
            onClose();
          }
        }}
      >
        <p>
          {comments.length
            ? `${comments.length} ${comments.length > 1 ? commentsText : commentText}`
            : commentsText}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label={close}
          className="hover:bg-muted rounded-full p-1"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 [touch-action:pan-y] overflow-y-auto overscroll-contain">
        {canComment ? (
          post.commentPolicy === "FOLLOWERS" && (
            <p className="text-muted-foreground px-4 py-2 text-center text-sm">
              {commentsFollowersOnly}
            </p>
          )
        ) : (
          <p className="text-muted-foreground px-4 py-3 text-center text-sm">
            {post.commentPolicy === "NO_ONE"
              ? commentsDisabled
              : commentsFollowersOnly}
          </p>
        )}
        {isFetchingNextPage && (
          <Loader2 className="mx-auto my-3 animate-spin sm:hidden" />
        )}
        {hasNextPage && !isFetchingNextPage && status === "success" && (
          <Button
            variant="link"
            className="mx-auto block sm:hidden"
            disabled={isFetching}
            onClick={() => fetchNextPage()}
          >
            {showPreviousComments}
          </Button>
        )}
        {status === "pending" && (
          <div aria-busy="true" className="min-h-48 w-full px-3 py-1">
            <CommentsLoadingSkeleton />
          </div>
        )}
        {status === "success" && !comments.length && !hasNextPage && (
          <p className="text-muted-foreground flex min-h-40 w-full items-center justify-center py-4 text-center">
            {noComments}
          </p>
        )}
        {status === "error" && (
          <p className="text-muted-foreground flex min-h-40 w-full items-center justify-center py-4 text-center">
            {dataError}
          </p>
        )}
        <div
          className={cn(
            "divide-y-2",
            (status === "pending" ||
              (status === "success" && !comments.length && !hasNextPage) ||
              status === "error") &&
              "hidden",
          )}
        >
          <div className="max-sm:bg-card/50 space-y-1 py-1">
            {comments.map((comment) => (
              <Comment
                key={comment.id}
                comment={comment}
                isTarget={
                  !!targetComment?.trim() && comment.id === targetComment
                }
              />
            ))}
          </div>
          {isFetchingNextPage && (
            <Loader2 className="mx-auto my-3 animate-spin max-sm:hidden" />
          )}
          {hasNextPage && !isFetchingNextPage && status === "success" && (
            <Button
              variant="link"
              className="mx-auto block max-sm:hidden"
              disabled={isFetching}
              onClick={() => fetchNextPage()}
            >
              {showPreviousComments}
            </Button>
          )}
        </div>
      </div>
      {canComment && (
        <div className="shrink-0 border-t">
          <CommentInput post={post} />
        </div>
      )}
    </div>
  );
}
