import { useSession } from "@/app/(main)/SessionProvider";
import Linkify from "@/components/Linkify";
import Time from "@/components/Time";
import OchoLink from "@/components/ui/OchoLink";
import UserAvatar from "@/components/UserAvatar";
import UserTooltip from "@/components/UserTooltip";
import { CommentData } from "@/lib/types";
import { cn } from "@/lib/utils";
import CommentMoreButton from "../CommentMoreButton";
import LikeButton from "./LikeButton";
import ReplyButton from "./ReplyButton";
import ReplyInput from "./ReplyInput";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { AuthorLikeIcon } from "../Comment";
import Verified from "@/components/Verified";
import { VerifiedType } from "@prisma/client";
import { useTranslation } from "@/context/LanguageContext";

interface CommentProps {
  comment: CommentData;
  isTarget?: boolean;
}

export default function Reply({ comment, isTarget = false }: CommentProps) {
  const { user } = useSession();

  const { t } = useTranslation();

  const { appUser, author } = t();
  const [showInput, setShowInput] = useState(false);
  const [authorLiked, setAuthorLiked] = useState(false);

   const expiresAt = comment.user.verified?.[0]?.expiresAt;
  const canExpire = !!(expiresAt ? new Date(expiresAt).getTime() : null);

  const expired = canExpire && expiresAt ? new Date() < expiresAt : false;

  const isVerified = !!comment.user.verified[0] && !expired;
  const verifiedType: VerifiedType = isVerified
    ? comment.user.verified[0].type
    : "STANDARD";

  const verifiedCheck = isVerified ? <Verified type={verifiedType} /> : null;


  return (
    <div
      className={cn(
        "group/reply flex flex-shrink-0 flex-col items-end px-2 py-3 transition-all *:flex-shrink-0 sm:rounded-sm",
        // isTarget &&
        //   "p-s-4 border-solid border-s-primary bg-primary/10 sm:border-4 sm:border-primary/50",
      )}
    >
      <div className={cn("flex w-full gap-3")}>
        <UserTooltip user={comment.user} verified={verifiedCheck}>
          <span>
            <OchoLink
              href={`/users/${comment.user.username || "-"}`}
              className="max-sm:hidden"
            >
              <UserAvatar userId={comment.user.id} avatarUrl={comment.user.avatarUrl} size={36} />
            </OchoLink>
            <span className="sm:hidden">
              <UserAvatar userId={comment.user.id} avatarUrl={comment.user.avatarUrl} size={36} />
            </span>
          </span>
        </UserTooltip>
        <div className="relative flex-1">
          <div className="flex w-full justify-between">
            <div className="flex flex-1 items-center text-sm text-muted-foreground">
              <UserTooltip user={comment.user}  verified={verifiedCheck}>
                <div className="items-center">
                  <span className="inline-flex items-center gap-0.5">
                    <OchoLink
                      href={`/users/${comment.user.username || "-"}`}
                      className="font-medium text-inherit max-sm:hidden"
                    >
                      {comment.user.displayName || appUser}
                    </OchoLink>
                    <span className="font-medium hover:underline sm:hidden">
                      {comment.user.displayName || appUser}
                    </span>
                    {verifiedCheck}
                  </span>
                  {comment.userId === comment.post.userId && (
                    <span className="space-x-1 ps-1 text-primary">
                      <span className="font-bold">•</span>
                      <span>{author}</span>
                    </span>
                  )}
                </div>
              </UserTooltip>
              {comment.firstLevelCommentId !== comment.commentId && (
                <div className="items-center">
                  <OchoLink
                    href={`users/${comment.comment?.user.username || "-"}`}
                    className="flex items-center gap-1 font-medium text-inherit max-sm:hidden"
                  >
                    <span className="flex items-center">
                      <ChevronRight size={16} />
                      {comment.comment?.user.displayName || appUser}
                    </span>
                  </OchoLink>
                  <span className="flex items-center font-medium hover:underline sm:hidden">
                    <ChevronRight size={16} />
                    {comment.comment?.user.displayName || appUser}
                  </span>
                </div>
              )}
            </div>
            {comment.user.id === user.id && (
              <CommentMoreButton
                comment={comment}
                className="absolute right-0 top-0 opacity-0 transition-opacity group-hover/reply:opacity-100 max-sm:opacity-100"
              />
            )}
          </div>
          <Linkify postId={comment.postId}>
            <p>{comment.content}</p>
          </Linkify>
          <div className="">
            <span className="text-xs text-muted-foreground">
              <Time time={comment.createdAt} long />
            </span>
          </div>
          <div className="flex w-full items-center gap-4">
            <LikeButton
              comment={comment}
              initialState={{
                likes: comment._count.likes,
                isLikedByUser: comment.likes.some(
                  (like) => like.userId === user.id,
                ),
                isLikedByAuthor: comment.likes.some(
                  (like) => like.userId === comment.post.userId,
                ),
              }}
              onAuthorLikeChange={setAuthorLiked}
            />
            <ReplyButton
              replies={comment._count.replies}
              onClick={() => setShowInput(true)}
            />
            {authorLiked && (
              <AuthorLikeIcon avatarUrl={comment.post.user.avatarUrl} userId={comment.post.user.id} />
            )}
          </div>
        </div>
      </div>
      {showInput && (
        <ReplyInput comment={comment} onClose={() => setShowInput(false)} />
      )}
    </div>
  );
}
