import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { Loader2 } from "lucide-react";
import OchoLink from "@/components/ui/OchoLink";
import { Suspense } from "react";
import UserAvatar from "./UserAvatar";
import { unstable_cache } from "next/cache";
import FormattedInt from "./FormattedInt";
import FollowButton from "./FollowButton";
import { getUserDataSelect } from "@/lib/types";
import UserTooltip from "./UserTooltip";
import { getTranslation } from "@/lib/language";

export default function TrendsSidebar() {
  return (
    <div className="sticky top-0 hidden h-full w-72 flex-none space-y-3 rounded-2xl md:block lg:w-80 overflow-y-auto">
      <Suspense fallback={<Loader2 className="mx-auto animate-spin" />}>
        <WhoToFollow />
        <TrendingTopics />
      </Suspense>
    </div>
  );
}

async function WhoToFollow() {
  const { user } = await validateRequest();
  const { whoToFollow, noOneToFollow } = await getTranslation();
  if (!user) return null;

  const loggedInUserData = await prisma.user.findFirst({
    where: {
      id: {
        equals: user.id,
        mode: "insensitive",
      },
    },
    select: getUserDataSelect(user.id),
  });

  if (!loggedInUserData) return null;

  const usersToFollow = await prisma.user.findMany({
    where: {
      NOT: {
        id: user.id,
      },
      followers: {
        none: {
          followerId: user.id,
        },
      },
    },
    select: getUserDataSelect(user.id),
    orderBy: {
      followers: {
        _count: "desc",
      }
    },
    take: 5,
  });

  return (
    <div className="space-y-5 bg-card p-5 shadow-sm sm:rounded-3xl">
      <h2 className="text-xl font-bold">{whoToFollow}</h2>
      {usersToFollow.map((user) => {
        const now = Date.now();

        const lastSeenDate = new Date(user.lastSeen).getTime() - 60 * 1000;

        const isUserOnline = lastSeenDate > now;
        return (
          <div
            key={user.id}
            className="flex items-center justify-between gap-3"
          >
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
                  <h3 className="line-clamp-1 break-all font-semibold hover:underline">
                    {user.displayName}
                  </h3>
                  <p className="line-clamp-1 break-all text-muted-foreground">
                    @{user.username}
                  </p>
                </div>
              </OchoLink>
            </UserTooltip>
            <FollowButton
              userId={user.id}
              initialState={{
                followers: user._count.followers,
                isFollowedByUser: user.followers.some(
                  ({ followerId }) => followerId === user.id,
                ),
                isFolowing: loggedInUserData.followers.some(
                  ({ followerId }) => followerId === user.id,
                ),
                isFriend:
                  user.followers.some(
                    ({ followerId }) => followerId === loggedInUserData.id,
                  ) &&
                  loggedInUserData.followers.some(
                    ({ followerId }) => followerId === user.id,
                  ),
              }}
            />
          </div>
        );
      })}
      {!usersToFollow.length && (
        <p className="w-full px-2 py-8 text-center italic text-muted-foreground">
          {noOneToFollow}
        </p>
      )}
    </div>
  );
}

const getTrendingTopics = unstable_cache(
  async () => {
    const result = await prisma.$queryRaw<{ hashtag: string; count: bigint }[]>`
        SELECT LOWER(unnest(regexp_matches(content, '#[[:alnum:]_-]+', 'g'))) AS hashtag, COUNT(*) as count 
        FROM posts
        GROUP BY hashtag
        ORDER BY count DESC, hashtag ASC
        LIMIT 5
        `;
    return result.map((row) => ({
      hashtag: row.hashtag,
      count: Number(row.count),
    }));
  },
  ["trending_topics"],
  {
    revalidate: 3 * 3600,
  },
);

async function TrendingTopics() {
  const trendingTopics = await getTrendingTopics();
  const { trending, noTrends, aPost, posts } = await getTranslation();

  return (
    <div className="space-y-5 bg-card p-5 shadow-sm sm:rounded-3xl">
      <h2 className="text-xl font-bold">{trending}</h2>
      {!trendingTopics.length && (
        <p className="w-full px-2 py-8 text-center italic text-muted-foreground">
          {noTrends}
        </p>
      )}
      {trendingTopics.map(({ hashtag, count }) => {
        const title = hashtag.split("#")[1];

        return (
          <OchoLink key={title} href={`/hashtag/${title}`} className="block text-inherit">
            <h3
              className="line-clamp-1 break-all font-semibold hover:underline"
              title={hashtag}
            >
              {hashtag}
            </h3>
            <p className="break-all text-sm text-muted-foreground">
              <FormattedInt number={count} /> {count === 1 ? aPost : posts}
            </p>
          </OchoLink>
        );
      })}
    </div>
  );
}
