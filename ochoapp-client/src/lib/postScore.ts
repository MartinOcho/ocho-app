import { cache } from "react";
import { PostData, UserData } from "./types";

export const calculateRelevanceScore = cache(
  (
    post: PostData,
    user: UserData,
    latestPostId?: string,
  ): number => {
    const postId = post.id;
    const userId = user.id;
    const comments = post._count.comments;
    const likes = post._count.likes;
    const bookmarks = post.bookmarks.length;

    const now = new Date();
    const postAgeHours = (now.getTime() - post.createdAt.getTime()) / (1000 * 60 * 60);

    // Calcul de l'engagement
    const engagementScore = likes * 2 + comments * 3 + bookmarks * 1.5;

    // Définir les fourchettes pour le facteur temporel
    let timeFactor = 1; // Par défaut pour les posts récents
    if (postAgeHours > 24 && postAgeHours <= 72) {
      timeFactor = 0.95; // Post récent (1 à 3 jours)
    } else if (postAgeHours > 72 && postAgeHours <= 168) {
      timeFactor = engagementScore > 0 ? 0.9 : 0.8; // Post modérément ancien (3 à 7 jours)
    } else if (postAgeHours > 168) {
      timeFactor = engagementScore > 0 ? 0.85 : 0.6; // Post ancien (> 7 jours)
    }

    // Calcul du score de proximité
    const proximityScore = post.user.followers.some(
      (follower) => follower.followerId === userId,
    )
      ? 5
      : 0;

    // Bonus pour les types de contenu
    const typeFactor =
      post.attachments.length > 0 ? (post.content.length ? 1.5 : 1.25) : 1;

    // Bonus pour les gradients
    const gradientFactor =
      !post.attachments.length && post.content.length < 100 && post.gradient
        ? 1.5
        : 1;

    // Bonus pour le dernier post
    const latestPostBonus = latestPostId && post.id === latestPostId ? 100 : 0;

    // Calcul final
    return (
      engagementScore * timeFactor +
      proximityScore +
      typeFactor +
      gradientFactor +
      latestPostBonus
    );
  },
);
