import { validateRequest } from "@/auth";
import FollowButton from "@/components/FollowButton";
import Linkify from "@/components/Linkify";
import Post from "@/components/posts/Post";
import SetNavigation from "@/components/SetNavigation";
import UserAvatar from "@/components/UserAvatar";
import UserTooltip from "@/components/UserTooltip";
import prisma from "@/lib/prisma";
import { getPostDataIncludes, getUserDataSelect, UserData } from "@/lib/types";
import { Loader2 } from "lucide-react";
import OchoLink from "@/components/ui/OchoLink";
import { notFound, redirect } from "next/navigation";
import { cache, Suspense } from "react";
import { translation } from "@/lib/vocabulary";

interface PageProps {
  params: Promise<{ postId: string }>;
  searchParams: Promise<{ comment?: string }>;
}

// Ajoutez une vérification pour le commentaire cible
const getPost = cache(
  async (postId: string, loggedInUserId: string, targetComment?: string) => {
    const postUser = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        user: true,
      },
    });
    const username = postUser?.user.username;
    const post = await prisma.post.findFirst({
      where: {
        AND: [
          { id: postId },
          {
            OR: [
              {
                userId: loggedInUserId,
              },
              {
                visibility: "FOLLOWERS",
                user: {
                  followers: {
                    some: {
                      followerId: loggedInUserId,
                    },
                  },
                },
              },
              {
                visibility: "PUBLIC",
              },
            ],
          },
        ],
      },
      include: getPostDataIncludes(loggedInUserId, username),
    });

    if (!post) notFound();

    // Vérifiez si le commentaire cible existe
    if (targetComment) {
      const commentExists = await prisma.comment.findFirst({
        where: { id: targetComment, postId },
      });

      // Si le commentaire n'existe pas, redirigez vers la page de post sans le paramètre `comment`
      if (!commentExists) {
        redirect(`/posts/${postId}`);
      }
    }

    return post;
  },
);

export async function generateMetadata({ params }: PageProps) {
  const { user } = await validateRequest();
  const { postId } = await params;
  const post = await getPost(postId, user?.id || "");

  if (!post) return;

  const hasImage = post.attachments.some(
    (attachment) => attachment.type === "IMAGE",
  );
  const hasVideo = post.attachments.some(
    (attachment) => attachment.type === "VIDEO",
  );

  const attachmentTitle =
    hasImage && hasVideo
      ? "Images et vidéos"
      : hasImage
        ? "Images"
        : hasVideo
          ? "Vidéos"
          : "Médias";

  const userTitle = `OchoApp - ${translation("usersPost", { name: post.user.displayName })}`;

  const title = userTitle.trim().length
    ? userTitle
    : post.content
      ? `${post.content.slice(0, 20)}${post.content.length > 20 ? "..." : ""}`
      : attachmentTitle;

  const description =
    post.content || `Publication de ${post.user.displayName} sur OchoApp`;
  const images = post.attachments
    .filter((a) => a.type === "IMAGE")
    .map((a) => ({ url: a.url }));

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images,
      type: "article",
      authors: [post.user.displayName],
    },
    twitter: {
      card: images.length > 0 ? "summary_large_image" : "summary",
      title,
      description,
      images: images.map((i) => i.url),
    },
  };
}

export default async function Page({ params, searchParams }: PageProps) {
  const { postId } = await params;
  const { comment } = await searchParams;
  const { user } = await validateRequest();

  const post = await getPost(postId, user?.id || "", comment);

  return (
    <main className="flex w-full min-w-0 gap-5 pb-4 max-sm:py-4">
      <SetNavigation navPage={null} />
      <div className="w-full min-w-0 space-y-5 pb-4">
        <Post post={post} />
      </div>
      <div className="sticky top-0 hidden h-fit w-80 flex-none lg:block">
        <Suspense fallback={<Loader2 className="mx-auto my-3 animate-spin" />}>
          <UserInfoSidebar user={post.user} loggedInUserId={user?.id} />
        </Suspense>
      </div>
    </main>
  );
}

interface UserInfoSidebarProps {
  user: UserData;
  loggedInUserId?: string;
}

async function UserInfoSidebar({ user, loggedInUserId }: UserInfoSidebarProps) {
  const loggedInUserData = loggedInUserId
    ? await prisma.user.findFirst({
        where: { id: { equals: loggedInUserId, mode: "insensitive" } },
        select: getUserDataSelect(user.id),
      })
    : null;

  return (
    <div className="bg-card space-y-5 rounded-2xl p-5 shadow-sm">
      <h2 className="text-xl font-bold">À propos de {user.displayName}</h2>
      <UserTooltip user={user}>
        <OchoLink
          href={`/users/${user.username}`}
          className="flex items-center gap-3 text-inherit"
        >
          <UserAvatar
            userId={user.id}
            avatarUrl={user.avatarUrl}
            className="flex-none"
          />
          <div>
            <p className="line-clamp-1 font-semibold break-all hover:underline">
              {user.displayName}
            </p>
            <p className="text-muted-foreground line-clamp-1 break-all hover:underline">
              @{user.username}
            </p>
          </div>
        </OchoLink>
      </UserTooltip>
      <Linkify>
        <p className="text-muted-foreground line-clamp-6 break-words whitespace-pre-line">
          {user.bio}
        </p>
      </Linkify>
      {loggedInUserId && user.id !== loggedInUserId && (
        <FollowButton
          userId={user.id}
          initialState={{
            followers: user._count.followers,
            isFollowedByUser: user.followers.some(
              ({ followerId }) => followerId === loggedInUserId,
            ),
            isFolowing:
              loggedInUserData?.followers.some(
                ({ followerId }) => followerId === user.id,
              ) || false,
            isFriend:
              user.followers.some(
                ({ followerId }) => followerId === loggedInUserId,
              ) &&
              !!loggedInUserData?.followers.some(
                ({ followerId }) => followerId === user.id,
              ),
          }}
        />
      )}
    </div>
  );
}
