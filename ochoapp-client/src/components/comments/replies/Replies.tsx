import Comment from "@/components/comments/Comment";
import CommentsLoadingSkeleton from "@/components/comments/CommentsLoadingSkeleton";
import Draggable from "@/components/Draggable";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { t } from "@/context/LanguageContext";
import kyInstance from "@/lib/ky";
import { CommentData, CommentsPage, RepliesPage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import Reply from "./Reply";

interface RepliesProps {
  comment: CommentData;
  onClose: () => void;
  hidden: boolean;
  onCountChange: (count: number) => void;
  onAuthorReplyChange: (replied: boolean) => void;
}

export default function Replies({
  comment,
  onClose,
  hidden = true,
  onCountChange,
  onAuthorReplyChange,
}: RepliesProps) {
  const [targetComment, setTargetComment] = useState<string | null>(null);
  const [isDraggable, setIsDraggable] = useState(false);
  const previousWidth = useRef(window.innerWidth);

  const { showMore, hide, dataError, noComments } = t();

  const searchParams = useSearchParams();

  const { toast } = useToast();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ["replies", comment.id],
    queryFn: ({ pageParam }) =>
      kyInstance
        .get(`/api/posts/comments/${comment.id}/replies`, {
          searchParams: new URLSearchParams({
            cursor: pageParam ? String(pageParam) : "",
            comment: targetComment ? String(targetComment) : "",
          }),
        })
        .json<RepliesPage>(),
    initialPageParam: null as string | null,
    getNextPageParam: (firstPage) => firstPage.previousCursor,
  });

  useEffect(() => {
    const handleResize = () => {
      setIsDraggable(window.innerWidth < 640); // Active draggable si largeur < 640px
    };

    handleResize(); // Vérifie la taille initiale
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const currentWidth = window.innerWidth;
      if (currentWidth !== previousWidth.current) {
        previousWidth.current = currentWidth;
        onClose(); // Appelle la fonction uniquement pour les redimensionnements horizontaux
      }
    };

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const replies = data?.pages.flatMap((page) => page.replies) || [];
  const count = data?.pages[0].count || 0;

  useEffect(() => {
    if (status === "success" && comment) {
      const authorReplied = replies.some(
        (reply) => reply.user.id === comment.post.userId,
      );
      onAuthorReplyChange(authorReplied);
      setTargetComment(comment.id);
      onCountChange(count);
      
    }
    if (status === "error") {
      toast({
        variant: "destructive",
        description: dataError,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, comment, data]);

  if (comment.firstLevelCommentId) {
    return null;
  }

  return (
    <div className={cn("relative w-[calc(100%-2rem)] overflow-y-auto border-s-4 border-solid border-s-primary bg-background sm:w-[calc(100%-2.5rem)]", hidden && "hidden")}>
      <div className="flex w-full flex-col-reverse">
        <div className="flex w-full gap-4 p-2">
          {hasNextPage && !isFetchingNextPage && (
            <Button
              variant="link"
              disabled={isFetching || isFetchingNextPage}
              onClick={() => fetchNextPage()}
            >
              {showMore}
            </Button>
          )}
          <Button variant="link" onClick={onClose}>
            {hide}
          </Button>
        </div>
        {isFetchingNextPage && (
          <p className="w-full py-4 text-center text-muted-foreground max-sm:flex max-sm:items-center max-sm:justify-center">
            <Loader2 className="mx-auto my-3 animate-spin" />
          </p>
        )}
        {status === "success" && !replies.length && !hasNextPage && (
          <p className="w-full py-4 text-center text-muted-foreground max-sm:flex max-sm:items-center max-sm:justify-center italic">
            {noComments}
          </p>
        )}
        {status === "pending" && (
          <Loader2 className="mx-auto my-3 animate-spin" />
        )}
        <div
          className={cn(
            "divide-y-2",
            (status === "pending" ||
              (status === "success" && !replies.length && !hasNextPage) ||
              status === "error") &&
              "hidden",
          )}
        >
          <div className="space-y-1 overflow-y-auto py-1">
            {replies.map((reply) => (
              <Reply
                key={reply.id}
                comment={reply}
                isTarget={
                  !!targetComment?.trim() && comment.id === targetComment
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
