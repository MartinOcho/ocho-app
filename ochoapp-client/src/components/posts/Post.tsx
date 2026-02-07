"use client";

import { PostData } from "@/lib/types";
import OchoLink from "@/components/ui/OchoLink";
import UserAvatar from "../UserAvatar";
import Time from "../Time";
import { useSession } from "@/app/(main)/SessionProvider";
import PostMoreButton from "./PostMoreButton";
import Linkify from "../Linkify";
import UserTooltip from "../UserTooltip";
import { Media, VerifiedType } from "@prisma/client";
import { cn } from "@/lib/utils";
import Image from "next/image";
import LikeButton from "./LikeButton";
import BookmarkButton from "./BookmarkButton";
import { useEffect, useRef, useState } from "react";
import {
  Maximize2,
  MessageSquareIcon,
  MessageSquareMore,
  Minimize2,
  X,
} from "lucide-react";
import Comments from "../comments/Comments";
import { Button } from "../ui/button";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "../ui/carousel";
import Zoomable from "../Zoomable";
import Verified from "../Verified";
import { useProgress } from "@/context/ProgressContext";
import kyInstance from "@/lib/ky";
import { useTranslation } from "@/context/LanguageContext";

interface PostProps {
  post: PostData;
}

export default function Post({ post }: PostProps) {
  const { user } = useSession();
  const { startNavigation: navigate } = useProgress();
  const pathname = usePathname();

  const [showComment, setShowComment] = useState(false);
  const [firstCommentRender, setFirstCommentRender] = useState(false);
  const [targetComment, setTargetComment] = useState<string | null>(null);
  const [isTouch, setIsTouch] = useState(false);

  const { t } = useTranslation();

  const {
    hideComments,
    comment: commentText,
    comments: commentsText,
    viewUserSProfile,
  } = t();
  if (pathname.startsWith(`/posts/${post.id}`)){
    kyInstance.post(`/api/posts/${post.id}/relevance/`, { throwHttpErrors: false }).catch(err=>console.log);
  }

  const searchParams = useSearchParams();
  const comment = searchParams.get("comment");
  const showCommentParam = searchParams.get("show-comment");

  useEffect(() => {
    addEventListener("touchstart", (e) => {
      setIsTouch(true);
    });
  }, [])


  const gradient = post.gradient
    ? `gadient-post gradient-${post.gradient} *:*:text-[inherit] *:*:font-bold`
    : "";

  useEffect(() => {
    // On récupère le paramètre `comment` depuis les paramètres de recherche
    if (comment || showCommentParam) {
      setShowComment(true);
    }
  }, [comment, showCommentParam]);
  useEffect(() => {
    showComment && setFirstCommentRender(true);
  }, [showComment, setFirstCommentRender]);
  function postPage(param: string = "") {
    if (pathname.startsWith(`/posts/${post.id}`)) {
      return;
    }
    navigate(`/posts/${post.id}${param}`);
  }

  const timestamp = post.createdAt.getTime();
  const now = Date.now();
  const diffInMs = now - timestamp;

  const relative = diffInMs < Math.abs(48 * 3600 * 1000);

  const lastSeenDate = new Date(post.user.lastSeen).getTime() - 40 * 1000;

  const isUserOnline = lastSeenDate > now;
  const maxGradientLength = 100;
  const canShowGradient =
    !post.attachments.length &&
    post.content.length <= maxGradientLength &&
    post.gradient;
  const expiresAt = post.user.verified?.[0]?.expiresAt;
  const canExpire = !!(expiresAt ? new Date(expiresAt).getTime() : null);

  const expired = canExpire && expiresAt ? new Date() < expiresAt : false;

  const isVerified = !!post.user.verified[0] && !expired;
  const verifiedType: VerifiedType = isVerified
    ? post.user.verified[0].type
    : "STANDARD";

  const verifiedCheck = isVerified ? <Verified type={verifiedType} /> : null;


  return (
    <article className="group/post z-0 flex flex-col bg-card/50 p-0.5 shadow-sm sm:rounded-md sm:bg-card">
      <div className="flex justify-between gap-3 p-5">
        <div className="flex flex-wrap gap-3">
          <UserTooltip user={post.user} verified={verifiedCheck}>
            <OchoLink
              href={`/users/${post.user.username}`}
              className="text-inherit"
              title={viewUserSProfile.replace(
                "[name]",
                post.user.displayName.split(" ")[0],
              )}
            >
              <UserAvatar
                userId={post.user.id}
                avatarUrl={post.user.avatarUrl}
                hideBadge={false}
              />
            </OchoLink>
          </UserTooltip>
          <div>
            <span className={cn(isVerified && "flex items-center gap-1")}>
              <UserTooltip user={post.user} verified={verifiedCheck}>
                <OchoLink
                  href={`/users/${post.user.username}`}
                  className="block font-medium text-inherit"
                >
                  {post.user.displayName}
                </OchoLink>
              </UserTooltip>
              {verifiedCheck}
            </span>
            <OchoLink
              href={`/posts/${post.id}`}
              className="block text-sm text-muted-foreground"
              suppressHydrationWarning
            >
              <Time
                time={post.createdAt}
                relative={relative}
                long={!relative}
              />
            </OchoLink>
          </div>
        </div>
        {post.user.id === user.id && (
          <PostMoreButton
            post={post}
            className={cn(!isTouch && "sm:opacity-0", "transition-opacity group-hover/post:opacity-100 max-sm:opacity-100")}
          />
        )}
      </div>
      <div
        className={cn(
          "relative flex flex-col gap-5 max-sm:p-2 sm:p-5",
          canShowGradient && "p-0",
        )}
      >
        <div
          className="absolute inset-0 h-full w-full"
          onClick={() => postPage()}
        ></div>
        {!!post.content && (
          <Linkify
            postId={post.id}
            className={cn(canShowGradient && "underline")}
          >
            <div
              className={cn(
                "z-10 whitespace-pre-line break-words",
                canShowGradient &&
                `${gradient} px-8 max-sm:rounded-none sm:rounded-md`,
                !post.attachments.length &&
                `${post.content.length <= 70 ? "text-3xl max-sm:text-2xl" : "text-lg max-sm:text-base"}`,
              )}
              onClick={() => {
                if (canShowGradient) {
                  postPage();
                }
              }}
            >
              <p className="w-full">{post.content}</p>
            </div>
          </Linkify>
        )}
        {!!post.attachments.length && (
          <MediaPreviews attachments={post.attachments} />
        )}
      </div>
      <hr className="text-muted-foreground" />
      <div className="flex justify-between gap-5 p-5">
        <div className="flex items-center gap-5">
          <LikeButton
            postId={post.id}
            recipientId={post.user.id}
            initialState={{
              likes: post._count.likes,
              isLikedByUser: post.likes.some((like) => like.userId === user.id),
            }}
          />
          <CommentButton
            comments={post._count.comments}
            onClick={() => {
              postPage("?show-comment=true");
              setShowComment(!showComment);
            }}
          />
        </div>
        <BookmarkButton
          postId={post.id}
          initialState={{
            isBookmarkedByUser: post.bookmarks.some(
              (bookmark) => bookmark.userId === user.id,
            ),
          }}
        />
      </div>
      <div
        className={cn(
          "bottom-0",
          !showComment &&
          "invisible fixed -bottom-full z-50 h-full w-full transition-[bottom]",
        )}
      >
        {showComment && (
          <div
            className="fixed inset-0 z-20 sm:hidden"
            onClick={() => setShowComment(false)}
          ></div>
        )}
        {firstCommentRender && (
          <Comments post={post} onClose={() => setShowComment(false)} />
        )}
        <Button
          variant="link"
          onClick={() => setShowComment(false)}
          className="mx-auto block max-sm:hidden"
        >
          {hideComments}
        </Button>
      </div>
    </article>
  );
}

interface MediaPreviewsProps {
  attachments: Media[];
}

function MediaPreviews({ attachments }: MediaPreviewsProps) {
  const { t } = useTranslation();
  const [showCarousel, setShowCarousel] = useState(false);
  const maxVisibleAttachments = 3;

  const handleShowMore = () => {
    setShowCarousel(true);
  };

  const [isFullscreen, setIsFullscreen] = useState<Record<number, boolean>>({});
  const containerRefs = useRef<(HTMLDivElement | null)[]>([]);

  const toggleFullscreen = (index: number) => {
    const element = containerRefs.current[index];
    if (element) {
      if (!document.fullscreenElement) {
        element.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const currentFullscreenElement = document.fullscreenElement;
      const isCurrentlyFullscreen = attachments.reduce(
        (acc, _, index) => {
          acc[index] =
            containerRefs.current[index] === currentFullscreenElement;
          return acc;
        },
        {} as Record<number, boolean>,
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [attachments]);

  return (
    <div>
      {/* Affichage de la grille des pièces jointes */}
      <div
        className={cn(
          "flex flex-col gap-3",
          attachments.length > 1 && "grid grid-cols-2",
        )}
      >
        {attachments.slice(0, maxVisibleAttachments).map((m) => (
          <div
            className={cn(
              "relative flex flex-shrink-0 items-center overflow-hidden rounded-xl text-primary",
              attachments.length > maxVisibleAttachments && "aspect-square",
            )}
            onClick={handleShowMore}
            key={m.id}
          >
            <MediaPreview
              media={m}
              className={cn(
                "aspect-square h-full w-full",
                attachments.length > maxVisibleAttachments && "object-cover",
              )}
              hidden
            />
          </div>
        ))}
        {/* Afficher le bouton "Voir plus" si le nombre de pièces jointes dépasse la limite */}
        {attachments.length > maxVisibleAttachments && (
          <div
            onClick={handleShowMore}
            className="relative flex aspect-square items-center overflow-hidden rounded-xl border-primary text-white underline"
          >
            <MediaPreview
              media={attachments[maxVisibleAttachments]}
              className="h-full w-full object-cover"
            />
            {attachments.length > 1 + maxVisibleAttachments && (
              <div className="absolute flex h-full w-full items-center justify-center bg-black/20 text-lg">
                +{attachments.length - maxVisibleAttachments}
              </div>
            )}
          </div>
        )}
      </div>

      {
        <div
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center bg-black/20",
            !showCarousel && "hidden",
          )}
        >
          <div className="relative flex h-full w-full items-center justify-center">
            <Carousel className="flex h-full w-full items-center *:w-full">
              <div
                className="fixed h-full w-full"
                onClick={() => setShowCarousel(false)}
              ></div>
              <CarouselContent className="h-full w-full">
                {attachments.map((m, i) => (
                  <CarouselItem key={m.id} className="w-full">
                    <div
                      className={cn(
                        "relative flex h-full w-full items-center justify-center",
                        !showCarousel && "pointer-events-none",
                      )}
                    >
                      <div
                        className={cn(
                          "relative w-fit overflow-hidden rounded-xl",
                          isFullscreen[i] &&
                          "fixed h-screen w-screen rounded-none",
                        )}
                        ref={(el) => {
                          containerRefs.current[i] = el;
                        }}
                      >
                        <MediaPreview
                          media={m}
                          useDefault
                          className={cn(
                            "object-contain max-sm:w-full sm:h-full sm:min-w-[500px]",
                            isFullscreen[i]
                              ? "absolute flex h-screen w-screen max-w-full items-center justify-center rounded-none"
                              : "sm:max-w-[800px]",
                          )}
                          hidden={showCarousel}
                        />
                        <div className="absolute right-2 top-2 flex items-center gap-2">
                          <div
                            className={cn(
                              "rounded-2xl",
                              isFullscreen[i] && "p-4",
                            )}
                          >
                            <FullscreenButton
                              isFullscreen={isFullscreen[i]}
                              onFullscreen={() => {
                                toggleFullscreen(i);
                              }}
                            />
                          </div>
                          {!isFullscreen[i] && attachments.length > 1 && (
                            <div className="rounded-2xl bg-primary/70 px-3 text-primary-foreground">
                              {i + 1}/{attachments.length}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {attachments.length > 1 && (
                <div className="absolute w-full max-w-[100vw] p-3">
                  <CarouselPrevious />
                  <CarouselNext />
                </div>
              )}
            </Carousel>
          </div>
          <div
            className="fixed right-4 top-4 cursor-pointer hover:text-red-500"
            onClick={() => setShowCarousel(false)}
          >
            <X size={40} className="" />
          </div>
        </div>
      }
    </div>
  );
}

interface MediaPreviewProps {
  media: Media;
  useDefault?: boolean;
  className?: string;
  hidden?: boolean;
}

function MediaPreview({
  media,
  useDefault,
  className,
  hidden,
}: MediaPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const { t } = useTranslation();

  // Pause la vidéo si le composant est masqué (hidden = true)
  useEffect(() => {
    if (videoRef.current && hidden) {
      videoRef.current.pause();
    }
  }, [hidden]);

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    // Clean up event listener on component unmount
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  if (media.type === "IMAGE") {
    return (
      <Zoomable clasName="mx-auto h-full w-full" zoomable={isFullscreen}>
        <Image
          src={media.url}
          alt="Attachment"
          width={500}
          height={500}
          className={cn(
            "h-full w-full rounded-xl bg-background object-cover shadow-sm outline outline-2 outline-muted max-sm:max-w-[500px]",
            isFullscreen
              ? "max-h-screen max-w-[100vw]"
              : "max-h-[90vh] max-w-[90vw]",
            className,
          )}
          loading="lazy"
        />
      </Zoomable>
    );
  }
  if (media.type === "VIDEO") {
    return (
      <Zoomable clasName="mx-auto h-full w-full" zoomable={isFullscreen}>
        <div
          className={cn(
            "relative flex h-full w-full grid-cols-1 grid-rows-1 overflow-auto rounded-xl shadow-sm",
            isFullscreen
              ? "max-h-screen max-w-[100vw]"
              : "max-h-[90vh] max-w-[90vw]",
            className,
          )}
        >
          <video
            ref={videoRef}
            controls={useDefault}
            height={500}
            width={500}
            className={cn(
              "relative h-full w-full bg-background shadow-sm",
              hidden
                ? "object-cover"
                : "absolute bottom-0 top-0 object-contain",
              isFullscreen
                ? "max-h-screen max-w-[100vw] object-contain"
                : "max-h-[90vh] max-w-[90vw]",
            )}
          >
            <source src={media.url} />
          </video>
        </div>
      </Zoomable>
    );
  }
  return <p className="text-destructive">Format media non supporté</p>;
}
interface FullscreenButtonProps {
  isFullscreen: boolean;
  onFullscreen: () => void;
}

function FullscreenButton({
  isFullscreen,
  onFullscreen,
}: FullscreenButtonProps) {
  return (
    <div
      className="cursor-pointer rounded bg-primary-foreground/80 p-1 hover:bg-primary-foreground"
      onClick={onFullscreen}
    >
      {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
    </div>
  );
}

interface CommentButtonProps {
  onClick: () => void;
  comments: number;
}
export function CommentButton({ comments, onClick }: CommentButtonProps) {

  const { t } = useTranslation();

  const { comment: commentText, comments: commentsText } = t();
  return (
    <button
      title={commentsText}
      onClick={onClick}
      className="flex items-center gap-2"
    >
      {!!comments ? <MessageSquareMore /> : <MessageSquareIcon />}
      {!!comments && (
        <span className="text-sm font-medium tabular-nums">
          {comments}{" "}
          <span className="hidden sm:inline">
            {comments > 1 ? commentsText : commentText}
          </span>
        </span>
      )}
    </button>
  );
}
