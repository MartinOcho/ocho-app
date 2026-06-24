import { PostData, UserData } from "./types";

export function calculateRelevanceScore(
  post: PostData,
  user: UserData,
  latestPostId?: string,
): number {
  const comments = post._count.comments;
  const likes = post._count.likes;
  const bookmarks = post.bookmarks.length;
  const userLiked = post.likes.length > 0;
  const userBookmarked = post.bookmarks.length > 0;
  const authorFollowed = post.user.followers.length > 0;
  const authorVerified = !!post.user.verified?.[0];
  const authorFollowersCount = post.user._count.followers ?? 0;
  const authorPostsCount = post.user._count.posts ?? 0;

  const now = Date.now();
  const postAgeHours = (now - post.createdAt.getTime()) / (1000 * 60 * 60);

  const engagementScore = likes * 1.6 + comments * 2.8 + bookmarks * 2.2;
  const freshnessMultiplier = postAgeHours <= 6
    ? 1.2
    : postAgeHours <= 24
    ? 1.1
    : postAgeHours <= 72
    ? 1
    : postAgeHours <= 168
    ? 0.85
    : 0.65;

  const recencyBonus = Math.max(0, 48 - postAgeHours) / 48 * 10;
  const proximityScore = authorFollowed ? 30 : 0;
  const interactionBonus = (userLiked ? 8 : 0) + (userBookmarked ? 8 : 0);
  const contentBonus = post.attachments.length > 0 ? 6 : 0;
  const gradientBonus =
    !post.attachments.length && post.content.length < 120 && post.gradient
      ? 4
      : 0;
  const verifiedBonus = authorVerified ? 3.5 : 0;
  const authorAuthorityScore =
    Math.log1p(authorFollowersCount) * 1.4 +
    Math.min(authorPostsCount, 120) * 0.04;
  const latestPostBonus = latestPostId && post.id === latestPostId ? 50 : 0;

  return (
    engagementScore * freshnessMultiplier +
    recencyBonus +
    proximityScore +
    interactionBonus +
    contentBonus +
    gradientBonus +
    verifiedBonus +
    authorAuthorityScore +
    latestPostBonus
  );
}
