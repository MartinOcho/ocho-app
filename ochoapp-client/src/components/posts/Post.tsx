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
  ChevronLeft,
  ChevronRight,
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
  type CarouselApi,
} from "../ui/carousel";
import Zoomable from "../Zoomable";
import Verified from "../Verified";
import { useProgress } from "@/context/ProgressContext";
import kyInstance from "@/lib/ky";
import { useTranslation } from "@/context/LanguageContext";

import { Share2 } from "lucide-react";
import { toast } from "../ui/use-toast";
import AppLogo from "../AppLogo";
import Link from "next/link";
import { usePostModal } from "@/context/PostModalContext";
import { createPortal } from "react-dom";

interface PostProps {
  post: PostData;
}

export default function Post({ post }: PostProps) {
  const { user } = useSession();
  const { startNavigation: navigate } = useProgress();
  const { openPost } = usePostModal();
  const pathname = usePathname();

  const [showComment, setShowComment] = useState(false);
  const [firstCommentRender, setFirstCommentRender] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [isCarouselFullscreen, setIsCarouselFullscreen] = useState(false);

  const { t } = useTranslation();

  const { hideComments, viewUserSProfile } = t();

  useEffect(() => {
    if (pathname.startsWith(`/posts/${post.id}`) && !!user.id) {
      void kyInstance
        .post(`/api/posts/${post.id}/relevance/`, { throwHttpErrors: false })
        .catch(() => {});
    }
  }, [pathname, post.id]);

  const searchParams = useSearchParams();
  const comment = searchParams.get("comment");
  const showCommentParam = searchParams.get("show-comment");

  useEffect(() => {
    const handleTouchStart = () => setIsTouch(true);
    window.addEventListener("touchstart", handleTouchStart);
    return () => window.removeEventListener("touchstart", handleTouchStart);
  }, []);

  const gradient = post.gradient
    ? `gradient-post gradient-${post.gradient} *:*:text-[inherit] *:*:font-bold`
    : "";

  useEffect(() => {
    if (comment || showCommentParam) {
      setShowComment(true);
    }
  }, [comment, showCommentParam]);

  useEffect(() => {
    if (showComment) setFirstCommentRender(true);
  }, [showComment]);

  function postPage(param: string = "") {
    if (pathname.startsWith(`/posts/${post.id}`)) {
      return;
    }
    const href = `/posts/${post.id}${param}`;
    if (window.matchMedia("(min-width: 1024px)").matches) {
      openPost(post, href);
    } else {
      navigate(href);
    }
  }

  const timestamp =
    post.createdAt instanceof Date
      ? post.createdAt.getTime()
      : new Date(post.createdAt).getTime();
  const now = Date.now();
  const diffInMs = now - timestamp;

  const relative = diffInMs < 48 * 3600 * 1000;

  const lastSeenDate = new Date(post.user.lastSeen).getTime() - 40 * 1000;

  const maxGradientLength = 100;
  const canShowGradient =
    !post.attachments.length &&
    post.content.length <= maxGradientLength &&
    post.gradient;

  const expiresAt = post.user.verified?.[0]?.expiresAt;
  const isVerified =
    !!post.user.verified[0] && (!expiresAt || new Date() < new Date(expiresAt));
  const verifiedType: VerifiedType = isVerified
    ? post.user.verified[0].type
    : "STANDARD";

  const verifiedCheck = isVerified ? <Verified type={verifiedType} /> : null;

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/posts/${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `OchoApp - ${t("usersPost", { name: post.user.displayName })}`,
          text: post.content.slice(0, 100),
          url: shareUrl,
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        description: t("linkCopied"),
      });
    }
  };

  if (!user.id) {
    return (
      <DisconnectedPost
        post={post}
        verifiedCheck={verifiedCheck}
        gradient={gradient}
        canShowGradient={!!canShowGradient}
        relative={relative}
        onPostPage={postPage}
      />
    );
  }

  return (
    <article
      className={cn(
        "group/post font-emoji  bg-card/50 sm:bg-card relative flex max-w-xl flex-col p-0.5 shadow-sm sm:rounded-md",
        isCarouselFullscreen && "z-50",
      )}
    >
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
              className="text-muted-foreground block text-sm"
              suppressHydrationWarning
              onClick={(event) => {
                event.preventDefault();
                postPage();
              }}
            >
              <Time
                time={post.createdAt}
                relative={relative}
                long={!relative}
              />
            </OchoLink>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleShare}
            className="text-muted-foreground cursor-pointer"
          >
            <Share2 size={20} />
          </Button>
          {post.user.id === user.id && (
            <PostMoreButton
              post={post}
              className={cn(
                !isTouch && "sm:opacity-0",
                "transition-opacity group-hover/post:opacity-100 max-sm:opacity-100",
              )}
            />
          )}
        </div>
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
                "z-10 wrap-break-word whitespace-pre-line",
                canShowGradient &&
                  `gradient-post aspect-video ${gradient} flex items-center justify-center rounded-[1.4rem] rounded-s-md text-center transition-all ${post.content.length <= 70 ? "text-3xl max-sm:text-lg" : "text-xl max-sm:text-base"}`,
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
          <MediaPreviews
            attachments={post.attachments}
            authorDisplayName={post.user.displayName}
            onFullscreenChange={(_index, isFullscreen) => {
              setIsCarouselFullscreen(isFullscreen);
            }}
            fullscreenDetails={
              <div className="flex h-full min-h-0 flex-col bg-card text-foreground">
                <div className="border-b p-4">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      userId={post.user.id}
                      avatarUrl={post.user.avatarUrl}
                      hideBadge={false}
                    />
                    <div>
                      <p className="font-semibold">
                        {post.user.displayName}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        <Time
                          time={post.createdAt}
                          relative={relative}
                          long={!relative}
                        />
                      </p>
                    </div>
                  </div>
                </div>
                {post.content && (
                  <div className="max-h-[30vh] overflow-y-auto border-b p-4">
                    <Linkify postId={post.id}>
                      <p className="wrap-break-word whitespace-pre-line">
                        {post.content}
                      </p>
                    </Linkify>
                  </div>
                )}
                <div className="flex items-center gap-5 border-b p-4">
                  <LikeButton
                    postId={post.id}
                    recipientId={post.user.id}
                    initialState={{
                      likes: post._count.likes,
                      isLikedByUser: post.likes.some(
                        (like) => like.userId === user.id,
                      ),
                    }}
                  />
                  <CommentButton
                    comments={post._count.comments}
                    onClick={() => setShowComment(true)}
                  />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <Comments
                    post={post}
                    onClose={() => setShowComment(false)}
                  />
                </div>
              </div>
            }
          />
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

function DisconnectedPost({
  post,
  verifiedCheck,
  gradient,
  canShowGradient,
  relative,
  onPostPage,
}: {
  post: PostData;
  verifiedCheck: React.ReactNode;
  gradient: string;
  canShowGradient: boolean | number;
  relative: boolean;
  onPostPage: () => void;
}) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { viewUserSProfile } = t();
  const isOpen = pathname.startsWith(`/posts/${post.id}`)

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/posts/${post.id}`;
    if (navigator.share) {
      await navigator.share({ title: "OchoApp", url: shareUrl });
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast({ description: t("linkCopied") });
    }
  };

  return (
    <div className={cn(isOpen && "flex flex-col items-center gap-4", "w-full")}>
      {
        isOpen && <Link href="/" className="text-2xl font-bold">
        <AppLogo size={70} />
      </Link>
      }
      <article className="group/post font-emoji bg-card/50 sm:bg-card relative flex max-w-xl flex-col p-0.5 shadow-sm sm:rounded-md">
        <div className="flex justify-between gap-3 p-5">
          <div className="flex flex-wrap gap-3">
            <OchoLink
              href={`/users/${post.user.username}`}
              className="text-inherit"
            >
              <UserAvatar
                userId={post.user.id}
                avatarUrl={post.user.avatarUrl}
                hideBadge={false}
              />
            </OchoLink>
            <div>
              <span className={cn(verifiedCheck && "flex items-center gap-1")}>
                <OchoLink
                  href={`/users/${post.user.username}`}
                  className="block font-medium text-inherit"
                >
                  {post.user.displayName}
                </OchoLink>
                {verifiedCheck}
              </span>
              <OchoLink
                href={`/posts/${post.id}`}
                className="text-muted-foreground block text-sm"
                onClick={(event) => {
                  event.preventDefault();
                  onPostPage();
                }}
              >
                <Time
                  time={post.createdAt}
                  relative={relative}
                  long={!relative}
                />
              </OchoLink>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleShare}
            className="text-muted-foreground cursor-pointer"
          >
            <Share2 size={20} />
          </Button>
        </div>
        <div
          className={cn(
            "relative flex flex-col gap-5 max-sm:p-2 sm:p-5",
            canShowGradient && "p-0",
          )}
        >
          {!!post.content && (
            <div
              className={cn(
                "z-10 wrap-break-word whitespace-pre-line",
                canShowGradient &&
                  `gradient-post aspect-video ${gradient} flex items-center justify-center rounded-[1.4rem] rounded-s-md text-center transition-all ${post.content.length <= 70 ? "text-3xl max-sm:text-lg" : "text-xl max-sm:text-base"}`,
                !post.attachments.length &&
                  `${post.content.length <= 70 ? "text-3xl max-sm:text-2xl" : "text-lg max-sm:text-base"}`,
              )}
            >
              <p className="w-full">{post.content}</p>
            </div>
          )}
          {!!post.attachments.length && (
            <MediaPreviews
              attachments={post.attachments}
              authorDisplayName={post.user.displayName}
            />
          )}
        </div>
        <div className="bg-muted/30 text-muted-foreground rounded-b-md p-5 text-center text-sm">
          <OchoLink
            href="/login"
            className="text-primary font-bold hover:underline"
          >
            {t("loginToInteract")}
          </OchoLink>
        </div>
      </article>
    </div>
  );
}

interface MediaPreviewsProps {
  attachments: Media[];
  startIndex?: number;
  onFullscreenChange?: (index: number, isFullscreen: boolean) => void;
  authorDisplayName?: string;
  fullscreenDetails?: React.ReactNode;
}

function MediaPreviews({
  attachments,
  startIndex = 0,
  onFullscreenChange,
  authorDisplayName,
  fullscreenDetails,
}: MediaPreviewsProps) {
  const { t } = useTranslation();
  const [showCarousel, setShowCarousel] = useState(false);
  const [index, setIndex] = useState(startIndex);
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const maxVisibleAttachments = 3;

  useEffect(() => {
    onFullscreenChange?.(index, showCarousel);
  }, [index, showCarousel, onFullscreenChange]);

  const handleShowMore = (nextIndex = startIndex) => {
    setIndex(nextIndex);
    setShowCarousel(true);
  };

  useEffect(() => {
    if (!api) {
      return;
    }

    const onSelect = () => {
      setIndex(api.selectedScrollSnap());
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    };

    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);

    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  useEffect(() => {
    if (!api) {
      return;
    }

    api.scrollTo(index);
  }, [api, index]);

  const [isFullscreen, setIsFullscreen] = useState<Record<number, boolean>>({});
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const containerRefs = useRef<(HTMLDivElement | null)[]>([]);

  const toggleFullscreen = (index: number) => {
    const fullscreenTarget = window.matchMedia("(min-width: 1024px)").matches
      ? viewerRef.current
      : containerRefs.current[index];

    if (!document.fullscreenElement && fullscreenTarget) {
      void fullscreenTarget.requestFullscreen().catch((error: unknown) =>
        console.error("Unable to enter fullscreen mode:", error),
      );
    } else if (document.fullscreenElement) {
      void document.exitFullscreen().catch((error: unknown) =>
        console.error("Unable to exit fullscreen mode:", error),
      );
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const currentFullscreenElement = document.fullscreenElement;
      const isCurrentlyFullscreen = attachments.reduce(
        (acc, _, index) => {
          acc[index] =
            (index === api?.selectedScrollSnap() &&
              viewerRef.current === currentFullscreenElement) ||
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
  }, [api, attachments]);

  return (
    <div>
      {/* Affichage de la grille des pièces jointes */}
      <div
        className={cn(
          "flex flex-col gap-3",
          attachments.length > 1 && "grid grid-cols-2",
        )}
      >
        {attachments.slice(0, maxVisibleAttachments).map((m, i) => (
          <div
            className={cn(
              "text-primary relative flex shrink-0 items-center overflow-hidden rounded-xl",
              attachments.length > maxVisibleAttachments && "aspect-square",
            )}
            onClick={() => handleShowMore(i)}
            key={m.id}
          >
            <MediaPreview
              media={m}
              className={cn(
                "aspect-square h-full w-full",
                attachments.length > maxVisibleAttachments && "object-cover",
              )}
              alt={
                authorDisplayName
                  ? `Image partagée par ${authorDisplayName} sur OchoApp`
                  : "Image partagée sur OchoApp"
              }
              hidden
            />
          </div>
        ))}
        {/* Afficher le bouton "Voir plus" si le nombre de pièces jointes dépasse la limite */}
        {attachments.length > maxVisibleAttachments && (
          <div
            onClick={() => handleShowMore(maxVisibleAttachments)}
            className="border-primary relative flex aspect-square items-center overflow-hidden rounded-xl text-white underline"
          >
            <MediaPreview
              media={attachments[maxVisibleAttachments]}
              className="h-full w-full object-cover"
              alt={
                authorDisplayName
                  ? `Image partagée par ${authorDisplayName} sur OchoApp`
                  : "Image partagée sur OchoApp"
              }
            />
            {attachments.length > 1 + maxVisibleAttachments && (
              <div className="absolute flex h-full w-full items-center justify-center bg-black/20 text-lg">
                +{attachments.length - maxVisibleAttachments}
              </div>
            )}
          </div>
        )}
      </div>

      {showCarousel &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={viewerRef}
            className="fixed inset-0 z-[100] flex bg-black/90"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setShowCarousel(false);
              }
            }}
          >
            <div className="relative flex h-full min-w-0 flex-1 items-center justify-center">
              <Carousel
                className="flex h-full w-full items-center *:w-full"
                opts={{ startIndex: index }}
                setApi={setApi}
              >
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
                            "relative flex h-full w-fit items-center justify-center overflow-hidden rounded-xl",
                            isFullscreen[i] &&
                              "max-lg:fixed max-lg:h-screen max-lg:w-screen max-lg:rounded-none",
                          )}
                          ref={(element) => {
                            containerRefs.current[i] = element;
                          }}
                        >
                          <MediaPreview
                            media={m}
                            useDefault
                            className={cn(
                              "object-contain max-sm:w-full sm:h-full sm:min-w-[500px]",
                              isFullscreen[i]
                                ? "max-h-screen max-w-[100vw] rounded-none lg:max-w-[calc(100vw-400px)]"
                                : "sm:max-w-[800px] lg:max-w-[calc(100vw-400px)]",
                            )}
                            alt={
                              authorDisplayName
                                ? `Image partagée par ${authorDisplayName} sur OchoApp`
                                : "Image partagée sur OchoApp"
                            }
                            hidden={false}
                          />
                          <div className="absolute top-2 right-2 flex items-center gap-2">
                            <div
                              className={cn(
                                "rounded-2xl",
                                isFullscreen[i] && "p-4",
                              )}
                            >
                              <FullscreenButton
                                isFullscreen={isFullscreen[i]}
                                onFullscreen={() => toggleFullscreen(i)}
                              />
                            </div>
                            {!isFullscreen[i] && attachments.length > 1 && (
                              <div className="bg-primary/70 text-primary-foreground rounded-2xl px-3">
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
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-between p-4">
                    {canScrollPrev && (
                      <div
                        className="bg-muted border-input text-muted-foreground pointer-events-auto flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2"
                        onClick={() => {
                          api?.scrollPrev();
                        }}
                      >
                        <ChevronLeft className="" />
                      </div>
                    )}
                    <div />
                    {canScrollNext && (
                      <div
                        className="bg-muted border-input text-muted-foreground pointer-events-auto flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2"
                        onClick={() => {
                          api?.scrollNext();
                        }}
                      >
                        <ChevronRight className="" />
                      </div>
                    )}
                  </div>
                )}
              </Carousel>
            </div>
            <aside className="hidden h-full w-[min(400px,32vw)] shrink-0 border-l border-border bg-card lg:block">
              {fullscreenDetails}
            </aside>
            <button
              type="button"
              aria-label={t("close")}
              className="absolute top-4 right-4 z-20 cursor-pointer rounded-full bg-black/60 p-2 text-white hover:text-red-400"
              onClick={() => setShowCarousel(false)}
            >
              <X size={28} />
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}

interface MediaPreviewProps {
  media: Media;
  useDefault?: boolean;
  className?: string;
  hidden?: boolean;
  alt?: string;
}

function MediaPreview({
  media,
  useDefault,
  className,
  hidden,
  alt,
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
          alt={alt || "Image partagée sur OchoApp"}
          width={500}
          height={500}
          className={cn(
            "bg-background outline-muted h-full w-full rounded-xl object-cover shadow-sm outline-2 max-sm:max-w-[500px]",
            isFullscreen
              ? "max-h-screen max-w-[100vw]"
              : "max-h-[90vh] max-w-[90vw]",
            className,
          )}
          loading={hidden ? "lazy" : "eager"}
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
              "bg-background relative h-full w-full shadow-sm",
              hidden
                ? "object-cover"
                : "absolute top-0 bottom-0 object-contain",
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
  return <p className="text-destructive">{t("unsupportedMediaFormat")}</p>;
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
      className="bg-primary-foreground/80 hover:bg-primary-foreground cursor-pointer rounded p-1"
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
