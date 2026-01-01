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

interface PageProps {
  params: Promise<{ postId: string }>;
  searchParams: Promise<{ comment?: string }>;
}

// Ajoutez une vérification pour le commentaire cible
const getPost = cache(async (postId: string, loggedInUserId: string, targetComment?: string) => {
  const postUser = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      user: true
    },
  });
  const username = postUser?.user.username
  const post = await prisma.post.findUnique({
    where: { id: postId },
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
});

export async function generateMetadata({ params }: PageProps) {
  const { user } = await validateRequest();

  const { postId } = await params;

  if (!user) return;

  const post = await getPost(postId, user.id);
  const hasImage = post.attachments.some((attachment) => attachment.type === "IMAGE");
  const hasVideo = post.attachments.some((attachment) => attachment.type === "VIDEO");
  const attachmentTitle  = hasImage && hasVideo ? "Images et vidéos" : hasImage ? "Images" : hasVideo ? "Vidéos" : "Medias";
  const title = post.content ? `${post.content.slice(0, 50)}${post.content.length > 50 ? "..." : "" }` : attachmentTitle;

  return {
    title,
  };
}

export default async function Page({ params, searchParams }: PageProps) {
  const { postId } = await params;
  const { comment } = await searchParams;
  const { user } = await validateRequest();
  if (!user)
    return (
      <p className="w-fit text-destructive">
        Vous n&apos;êtes pas autorisé à afficher cette page. veuillez
        d&apos;abord vous connecter ou creer un compte
      </p>
    );

  const post = await getPost(postId, user.id, comment);

  return (
    <main className="flex w-full min-w-0 gap-5 max-sm:py-4 pb-4">
      <SetNavigation navPage={null} />
      <div className="w-full min-w-0 space-y-5 pb-4">
        <Post post={post} />
      </div>
      <div className="sticky top-0 hidden h-fit w-80 flex-none lg:block">
        <Suspense fallback={<Loader2 className="mx-auto my-3 animate-spin" />}>
          <UserInfoSidebar user={post.user} />
        </Suspense>
      </div>
    </main>
  );
}

interface UserInfoSidebarProps {
  user: UserData;
}

async function UserInfoSidebar({ user }: UserInfoSidebarProps) {
  const { user: loggedInUser } = await validateRequest();

  if (!loggedInUser) return null;

  const loggedInUserData = await prisma.user.findFirst({
    where: { id: { equals: loggedInUser.id, mode: "insensitive" } },
    select: getUserDataSelect(user.id),
  });

  if (!loggedInUserData) return null;

  return (
    <div className="space-y-5 rounded-2xl bg-card p-5 shadow-sm">
      <h2 className="text-xl font-bold">A propos de {user.displayName}</h2>
      <UserTooltip user={user}>
        <OchoLink href={`/users/${user.username}`} className="flex items-center gap-3 text-inherit">
          <UserAvatar userId={user.id} avatarUrl={user.avatarUrl} className="flex-none" />
          <div>
            <p className="line-clamp-1 break-all font-semibold hover:underline">
              {user.displayName}
            </p>
            <p className="line-clamp-1 break-all text-muted-foreground hover:underline">
              @{user.username}
            </p>
          </div>
        </OchoLink>
      </UserTooltip>
      <Linkify>
        <p className="line-clamp-6 whitespace-pre-line break-words text-muted-foreground">
          {user.bio}
        </p>
      </Linkify>
      {user.id !== loggedInUser.id && (
        <FollowButton
          userId={user.id}
          initialState={{
            followers: user._count.followers,
            isFollowedByUser: user.followers.some(
              ({ followerId }) => followerId === loggedInUser.id,
            ),
            isFolowing: loggedInUserData.followers.some(
              ({ followerId }) => followerId === user.id,
            ),
            isFriend:
              user.followers.some(({ followerId }) => followerId === loggedInUser.id) &&
              loggedInUserData.followers.some(({ followerId }) => followerId === user.id),
          }}
        />
      )}
    </div>
  );
}
