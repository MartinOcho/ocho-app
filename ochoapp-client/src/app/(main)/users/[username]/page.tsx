import { validateRequest } from "@/auth";
import FollowButton from "@/components/FollowButton";
import FollowerCount from "@/components/FollowerCount";
import FormattedInt from "@/components/FormattedInt";
import Time from "@/components/Time";
import TrendsSidebar from "@/components/TrendsSidebar";
import UserAvatar from "@/components/UserAvatar";
import prisma from "@/lib/prisma";
import { FollowerInfo, getUserDataSelect, UserData } from "@/lib/types";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import UserPosts from "./UserPosts";
import Linkify from "@/components/Linkify";
import EditProfileButton from "./EditProfileButton";
import { Frown, Loader2 } from "lucide-react";
import SetNavigation from "@/components/SetNavigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Bookmarks from "../../../../components/bookmarks/Bookmarks";
import { PostLoadingSkeleton } from "@/components/posts/PostsLoadingSkeleton";
import { getTranslation } from "@/lib/language";
import Verified from "@/components/Verified";
import { VerifiedType } from "@prisma/client";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ username: string }>;
}

const getUser = cache(async (username: string, loggedInUserId: string) => {
  const user = await prisma.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: "insensitive",
      },
    },
    select: getUserDataSelect(loggedInUserId, username),
  });

  if (!user) notFound();

  return user;
});

const getLoggedUser = cache(async (userId: string, loggedInUserId: string) => {
  const user = await prisma.user.findFirst({
    where: {
      id: {
        equals: loggedInUserId,
        mode: "insensitive",
      },
    },
    select: getUserDataSelect(userId),
  });

  if (!user) notFound();

  return user;
});

export default async function page({ params }: PageProps) {
  const { username } = await params;
  return (
    <Suspense
      fallback={
        <>
          <div className="w-full max-w-lg">
            <PostLoadingSkeleton />
          </div>
          <div className="sticky top-0 hidden h-fit w-80 flex-none lg:block">
            <Loader2 className="mx-auto my-3 animate-spin" />
          </div>
        </>
      }
    >
      <Profile username={username} />
    </Suspense>
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { user: loggedInUser } = await validateRequest();

  const { username } = await params;

  if (!loggedInUser) return {};
  const user = await getUser(username, loggedInUser.id);
  return {
    title: `${user.displayName}`,
  };
}

interface ProfileProps {
  username: string;
}

async function Profile({ username }: ProfileProps) {
  const { user: loggedInUser } = await validateRequest();
  const { dataError, posts, bookmarks } = await getTranslation();

  if (!loggedInUser)
    return (
      <div className="my-8 flex w-full select-none flex-col items-center gap-2 text-center text-muted-foreground">
        <Frown size={150} />
        <h2 className="text-xl">{dataError}</h2>
      </div>
    );

  const user = await getUser(username, loggedInUser.id);
  const loggedUserData = await getLoggedUser(user.id, loggedInUser.id);

  return (
    <>
      <SetNavigation navPage={null} />
      <div className="w-full min-w-0 max-w-lg space-y-2 pb-2 sm:space-y-5">
        <UserProfile
          user={user}
          loggedInUserId={loggedInUser.id}
          loggedInUser={loggedUserData}
        />
        {user.id !== loggedInUser.id && (
          <div className="bg-card/50 p-5 shadow-sm sm:rounded-2xl sm:bg-card">
            <h2 className="text-center text-2xl font-bold">{posts}</h2>
          </div>
        )}
        {user.id === loggedInUser.id ? (
          <>
            <Tabs defaultValue="posts">
              <TabsList>
                <TabsTrigger value="posts">{posts}</TabsTrigger>
                <TabsTrigger value="bookmarks">{bookmarks}</TabsTrigger>
              </TabsList>
              <TabsContent value="posts" className="pb-2">
                <UserPosts
                  userId={user.id}
                  name={user.displayName.split(" ")[0]}
                />
              </TabsContent>
              <TabsContent value="bookmarks" className="pb-2">
                <Bookmarks />
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <UserPosts userId={user.id} name={user.displayName.split(" ")[0]} />
        )}
      </div>
      <TrendsSidebar />
    </>
  );
}

interface UserProfileProps {
  user: UserData;
  loggedInUserId: string;
  loggedInUser: UserData;
}

async function UserProfile({
  user,
  loggedInUserId,
  loggedInUser,
}: UserProfileProps) {
  const { memberSince, posts, aPost } = await getTranslation();
  const followerInfo: FollowerInfo = {
    followers: user._count.followers,
    isFollowedByUser: user.followers.some(
      ({ followerId }) => followerId === loggedInUserId,
    ),
    isFolowing: loggedInUser.followers.some(
      ({ followerId }) => followerId === user.id,
    ),
    isFriend:
      user.followers.some(({ followerId }) => followerId === loggedInUserId) &&
      loggedInUser.followers.some(({ followerId }) => followerId === user.id),
  };

  const expiresAt = user.verified?.[0]?.expiresAt;
  const canExpire = !!(expiresAt ? new Date(expiresAt).getTime() : null);

  const expired = canExpire && expiresAt ? new Date() < expiresAt : false;

  const isVerified = !!user.verified[0] && !expired;
  const verifiedType: VerifiedType = isVerified
    ? user.verified[0].type
    : "STANDARD";

  const verifiedCheck = isVerified ? <Verified type={verifiedType} /> : null;

  return (
    <div className="flex h-fit w-full flex-col items-center gap-5 bg-card/50 p-5 shadow-sm sm:rounded-2xl sm:bg-card">
      <UserAvatar
      userId={user.id}
        avatarUrl={user.avatarUrl}
        size={250}
        className="mx-auto size-full max-h-60 max-w-60 rounded-full"
        hideBadge={false}
      />
      <div className="flex w-full flex-wrap gap-3 sm:flex-nowrap">
        <div className="me-auto space-y-3">
          <div>
            <h1
              className={cn(
                "text-3xl font-bold",
                isVerified && "flex items-center gap-1.5",
              )}
            >
              {user.displayName}
              {verifiedCheck}
            </h1>
            <div className="text-muted-foreground">@{user.username}</div>
          </div>
          <div>
            {memberSince} <Time time={user.createdAt} long />
          </div>
          <div className="flex items-center gap-3">
            <span>
              <span className="font-semibold">
                <FormattedInt number={user._count.posts} />
              </span>{" "}
              {user._count.posts > 1 ? posts : aPost}
            </span>

            <FollowerCount userId={user.id} initialState={followerInfo} />
          </div>
        </div>
        {user.id === loggedInUserId ? (
          <EditProfileButton user={user} />
        ) : (
          <FollowButton userId={user.id} initialState={followerInfo} />
        )}
      </div>
      {user.bio && (
        <>
          <hr className="h-0.5 w-full" />
          <Linkify>
            <p className="overflow-hidden whitespace-pre-line break-words">
              {user.bio}
            </p>
          </Linkify>
        </>
      )}
    </div>
  );
}
