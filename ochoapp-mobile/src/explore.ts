import { Request, Response } from "express";
import prisma from "./prisma";
import { getCurrentUser, checkVerification } from "./auth";
import {
  ApiResponse,
  DiscoveryPage,
  DiscoveryItem,
  Post,
  User,
  getPostDataIncludes,
  getUserDataSelect,
} from "./types";
import { $Enums } from "@prisma/client";

export async function getDiscoveryFeed(req: Request, res: Response) {
  try {
    const { user: loggedUser, message } = await getCurrentUser(req.headers);
    if (!loggedUser) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "invalid_session",
      });
    }

    const cursor = req.query.cursor as string | undefined;
    const limit = parseInt(req.query.limit as string) || 20;

    // 1. Fetch Posts (Trending & Recent)
    const postsData = await prisma.post.findMany({
      where: {
        visibility: "PUBLIC",
      },
      include: getPostDataIncludes(loggedUser.id),
      orderBy: [
        { relevanceScore: "desc" },
        { createdAt: "desc" }
      ],
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
    });

    const hasMore = postsData.length > limit;
    const itemsToProcess = hasMore ? postsData.slice(0, limit) : postsData;
    const nextCursor = hasMore ? postsData[limit].id : null;

    // 2. Fetch User Suggestions (only on first page or periodically)
    let suggestedUsers: User[] = [];
    if (!cursor) {
      const usersToFollow = await prisma.user.findMany({
        where: {
          NOT: { id: loggedUser.id },
          followers: { none: { followerId: loggedUser.id } },
        },
        select: getUserDataSelect(loggedUser.id),
        orderBy: { followers: { _count: "desc" } },
        take: 3,
      });

      suggestedUsers = usersToFollow.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl || undefined,
        bio: u.bio || undefined,
        verified: checkVerification(u),
        createdAt: u.createdAt.getTime(),
        lastSeen: u.lastSeen.getTime(),
        followersCount: u._count.followers,
        postsCount: u._count.posts,
        isFollowing: false,
      }));
    }

    // 3. Construct Discovery Items
    const discoveryItems: DiscoveryItem[] = [];

    itemsToProcess.forEach((postData, index) => {
      // Add the post
      discoveryItems.push({
        id: `post_${postData.id}`,
        type: "POST",
        post: formatPost(postData, loggedUser.id)
      });

      // Inject a user suggestion every few posts (e.g., every 5 posts)
      if (suggestedUsers.length > 0 && (index + 1) % 5 === 0) {
        const suggestedUser = suggestedUsers.shift();
        if (suggestedUser) {
          discoveryItems.push({
            id: `user_sug_${suggestedUser.id}`,
            type: "USER_SUGGESTION",
            user: suggestedUser
          });
        }
      }
    });

    // If there are still suggestions left, add them at the end if it's the first page
    if (!cursor && suggestedUsers.length > 0) {
        suggestedUsers.forEach(u => {
            discoveryItems.push({
                id: `user_sug_${u.id}`,
                type: "USER_SUGGESTION",
                user: u
            });
        });
    }

    return res.json({
      success: true,
      message: "Discovery feed fetched successfully",
      data: {
        items: discoveryItems,
        nextCursor
      }
    } as ApiResponse<DiscoveryPage>);

  } catch (error) {
    console.error("Discovery feed error:", error);
    return res.json({
      success: false,
      message: "An error occurred while fetching discovery feed",
    });
  }
}


export async function getTrendingTopics(req: Request, res: Response) {
    // Reuse trending hashtags logic but maybe with a different name or slightly adjusted
    // For now, let's just proxy it or re-implement for clarity
    try {
        const result = await prisma.$queryRaw<any[]>`
            SELECT
                LOWER(unnest(regexp_matches(p.content, '#[[:alnum:]_-]+', 'g'))) AS hashtag,
                COUNT(DISTINCT p.id) AS "postsCount",
                COUNT(l."postId") AS "likesCount"
            FROM posts p
            LEFT JOIN likes l ON p.id = l."postId"
            GROUP BY hashtag
            ORDER BY "postsCount" DESC, "likesCount" DESC
            LIMIT 10
        `;

        const hashtags = result.map((row) => ({
          name: row.hashtag,
          postsCount: Number(row.postsCount),
          likesCount: Number(row.likesCount),
        }));

        return res.json({
          success: true,
          data: hashtags,
        });
    } catch (error) {
        console.error("Trending topics error:", error);
        return res.json({ success: false, message: "Error fetching trending topics" });
    }
}
function formatPost(postData: { user: { id: string; username: string; displayName: string; avatarUrl: string | null; bio: string | null; profileVisibility: $Enums.Visibility; messagePrivacy: $Enums.MessagingPrivacy; showOnlineStatus: boolean; lastSeen: Date; createdAt: Date; _count: { followers: number; posts: number; }; following: { followerId: string; }[]; followers: { followerId: string; }[]; verified: { type: $Enums.VerifiedType; expiresAt: Date | null; }[]; }; _count: { comments: number; likes: number; }; likes: { userId: string; }[]; bookmarks: { userId: string; }[]; attachments: { url: string; type: $Enums.MediaType; id: string; createdAt: Date; postId: string | null; }[]; relevance: { relevanceScore: number; }[]; } & { id: string; createdAt: Date; userId: string; content: string; gradient: number | null; visibility: $Enums.Visibility; relevanceScore: number; }, id: string): Post | null | undefined {
  throw new Error("Function not implemented.");
}

