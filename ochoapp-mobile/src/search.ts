import { Request, Response } from "express";
import prisma from "./prisma";
import { checkVerification, getCurrentUser } from "./auth";
import {
  getPostDataIncludes,
  getUserDataSelect,
  Post,
  PostData,
  User,
  UserData,
  VerifiedUser,
} from "./types";
import { check } from "zod";
import { get } from "node:http";
import { Prisma } from "@prisma/client";


type SearchType = "posts" | "users" | "hashtags";

interface SearchFilters {
  type?: SearchType;
  limit?: number;
  cursor?: string;
  startDate?: number;
  endDate?: number;
}

/**
 * Formate un post pour la réponse API
 */
export function formatPost(post: PostData, userId: string): Post {
  const verified = checkVerification(post.user);
  return {
    id: post.id,
    author: {
      id: post.user.id,
      username: post.user.username,
      displayName: post.user.displayName,
      avatarUrl: post.user.avatarUrl,
      verified,
    },
    content: post.content,
    createdAt: post.createdAt.getTime(),
    attachments: post.attachments || [],
    gradient: post.gradient || undefined,
    likes: post._count?.likes || 0,
    comments: post._count?.comments || 0,
    isLiked: post.likes?.some((like: any) => like.userId === userId) || false,
    isBookmarked:
      post.bookmarks?.some((bookmark: any) => bookmark.userId === userId) ||
      false,
  };
}

export function formatUser(user: UserData): User {
  const userVerifiedData = user.verified?.[0];
  const expiresAt = userVerifiedData?.expiresAt;
  const canExpire = !!(expiresAt ? new Date(expiresAt).getTime() : null);
  const expired =
    canExpire && expiresAt
      ? new Date().getTime() > new Date(expiresAt).getTime()
      : false;
  const isVerified = !!userVerifiedData && !expired;

  const verified: VerifiedUser = {
    verified: isVerified,
    type: userVerifiedData?.type || null,
    expiresAt: expiresAt ? new Date(expiresAt).getTime() : null,
  };

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl || null,
    bio: user.bio,
    verified,
    createdAt: user.createdAt.getTime(),
    lastSeen: user.lastSeen ? user.lastSeen.getTime() : undefined,
    followersCount: user._count?.followers || 0,
    postsCount: user._count?.posts || 0,
    isFollowing: !!user.followers?.some(
      (follower) => follower.followerId === user.id,
    ),
  };
}

/**
 * Extrait les hashtags d'un texte (prend en compte les caractères accentués UTF-8)
 */
export function extractHashtags(text: string): string[] {
  if (!text) return [];
  // Expression régulière supportant les lettres Unicode (accents), chiffres et underscores
  const hashtags = text.match(/#[\p{L}\p{N}_]+/gu) || [];
  return [...new Set(hashtags.map((tag) => tag.toLowerCase()))];
}

// ============================================================================
// ENDPOINT: GET /api/search - RECHERCHE GÉNÉRALE (SANS FILTRE)
// ============================================================================

export async function searchGeneral(req: Request, res: Response) {
  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "invalid_session",
      });
    }

    const rawQuery = ((req.query.q as string) || (req.query.query as string) || "").trim();
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const cursor = req.query.cursor as string | undefined;

    if (!rawQuery) {
      return res.json({
        success: false,
        message: "Paramètre 'q' ou 'query' requis",
        name: "invalid_input",
      });
    }

    const cleanQuery = rawQuery.replace(/^#/, ""); // Mot-clé nettoyé du symbole #
    const isHashtagSearch = rawQuery.startsWith("#");

    // Condition de visibilité réutilisable pour les posts
    const visibilityWhere: Prisma.PostWhereInput = {
      OR: [
        { userId: user.id },
        {
          visibility: "FOLLOWERS",
          user: {
            followers: {
              some: { followerId: user.id },
            },
          },
        },
        { visibility: "PUBLIC" },
      ],
    };

    // Filtre de contenu adapté selon la présence du symbole #
    const postContentWhere: Prisma.PostWhereInput = isHashtagSearch
      ? { content: { contains: rawQuery, mode: "insensitive" } }
      : {
          OR: [
            { content: { search: cleanQuery } },
            { content: { contains: cleanQuery, mode: "insensitive" } },
            { user: { displayName: { contains: cleanQuery, mode: "insensitive" } } },
            { user: { username: { contains: cleanQuery, mode: "insensitive" } } },
          ],
        };

    // Recherche parallèle: posts, utilisateurs, hashtags
    const [postsData, usersData, hashtagPosts] = await Promise.all([
      // 1. Posts
      prisma.post.findMany({
        where: {
          AND: [postContentWhere, visibilityWhere],
        },
        include: getPostDataIncludes(user.id),
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        cursor: cursor?.startsWith("post_")
          ? { id: cursor.substring(5) }
          : undefined,
      }),

      // 2. Utilisateurs
      prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: cleanQuery, mode: "insensitive" } },
            { displayName: { contains: cleanQuery, mode: "insensitive" } },
          ],
        },
        select: getUserDataSelect(user.id),
        orderBy: { username: "asc" },
        take: limit + 1,
      }),

      // 3. Extraction des hashtags depuis les posts récents
      prisma.post.findMany({
        where: {
          AND: [
            {
              content: {
                contains: isHashtagSearch ? rawQuery : `#${cleanQuery}`,
                mode: "insensitive",
              },
            },
            visibilityWhere,
          ],
        },
        select: {
          content: true,
        },
        take: 300,
      }),
    ]);

    // Extraire, filtrer et dédoublonner les hashtags
    const targetTagFilter = cleanQuery.toLowerCase();
    const allHashtags = hashtagPosts
      .flatMap((p) => extractHashtags(p.content))
      .filter((tag) => tag.toLowerCase().includes(targetTagFilter));

    const uniqueHashtags = [...new Set(allHashtags)].slice(0, limit + 1);

    // Découpage pour pagination
    const posts = postsData.slice(0, limit);
    const users = usersData.slice(0, limit);
    const hashtags = uniqueHashtags.slice(0, limit);

    const formattedPosts = posts.map((p) => formatPost(p, user.id));
    const formattedUsers = users.map((u) => formatUser(u));

    return res.json({
      success: true,
      data: {
        posts: {
          items: formattedPosts,
          hasMore: postsData.length > limit,
          nextCursor:
            postsData.length > limit ? `post_${postsData[limit].id}` : null,
        },
        users: {
          items: formattedUsers,
          hasMore: usersData.length > limit,
          nextCursor:
            usersData.length > limit ? `user_${usersData[limit].id}` : null,
        },
        hashtags: {
          items: hashtags.map((tag) => ({ hashtag: tag })),
          hasMore: uniqueHashtags.length > limit,
        },
      },
    });
  } catch (error) {
    console.error("Erreur dans searchGeneral:", error);
    return res.json({
      success: false,
      message: "Une erreur est survenue. Veuillez réessayer.",
    });
  }
}

// ============================================================================
// ENDPOINT: GET /api/search/posts - RECHERCHE DE POSTS (AVEC FILTRES)
// ============================================================================

export async function searchPostsFiltered(req: Request, res: Response) {
  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "invalid_session",
      });
    }

    const rawQuery = ((req.query.q as string) || "").trim();
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const cursor = req.query.cursor as string | undefined;
    const startDate = req.query.startDate
      ? parseInt(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? parseInt(req.query.endDate as string)
      : undefined;

    if (!rawQuery) {
      return res.json({
        success: false,
        message: "Paramètre 'q' requis",
      });
    }

    const cleanQuery = rawQuery.replace(/^#/, "");
    const isHashtagSearch = rawQuery.startsWith("#");

    const contentFilter: Prisma.PostWhereInput = isHashtagSearch
      ? { content: { contains: rawQuery, mode: "insensitive" } }
      : {
          OR: [
            { content: { search: cleanQuery } },
            { content: { contains: cleanQuery, mode: "insensitive" } },
            { user: { displayName: { contains: cleanQuery, mode: "insensitive" } } },
            { user: { username: { contains: cleanQuery, mode: "insensitive" } } },
          ],
        };

    const visibilityWhere: Prisma.PostWhereInput = {
      OR: [
        { userId: user.id },
        {
          visibility: "FOLLOWERS",
          user: {
            followers: {
              some: { followerId: user.id },
            },
          },
        },
        { visibility: "PUBLIC" },
      ],
    };

    const whereClause: Prisma.PostWhereInput = {
      AND: [
        contentFilter,
        visibilityWhere,
        {
          createdAt: {
            gte: startDate ? new Date(startDate) : undefined,
            lte: endDate ? new Date(endDate) : undefined,
          },
        },
      ],
    };

    const posts = await prisma.post.findMany({
      where: whereClause,
      include: getPostDataIncludes(user.id),
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
    });

    const hasMore = posts.length > limit;
    const postsData = posts.slice(0, limit);
    const nextCursor = hasMore ? posts[limit].id : null;

    return res.json({
      success: true,
      data: {
        activities: postsData.map((p) => ({
          id: p.id,
          activityType: "POST",
          createdAt: p.createdAt.getTime(),
          entityId: p.id,
          entity: formatPost(p, user.id),
        })),
        total: postsData.length,
        hasMore,
        nextCursor,
      },
    });
  } catch (error) {
    console.error("Erreur dans searchPostsFiltered:", error);
    return res.json({
      success: false,
      message: "Une erreur est survenue. Veuillez réessayer.",
    });
  }
}

// ============================================================================
// ENDPOINT: GET /api/search/users - RECHERCHE D'UTILISATEURS
// ============================================================================

export async function searchUsers(req: Request, res: Response) {
  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "invalid_session",
      });
    }

    const rawQuery = ((req.query.q as string) || "").trim();
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const cursor = req.query.cursor as string | undefined;

    if (!rawQuery) {
      return res.json({
        success: false,
        message: "Paramètre 'q' requis",
      });
    }

    const cleanQuery = rawQuery.replace(/^@/, "");

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: cleanQuery, mode: "insensitive" } },
          { displayName: { contains: cleanQuery, mode: "insensitive" } },
        ],
      },
      select: getUserDataSelect(user.id),
      orderBy: { username: "asc" },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
    });

    const hasMore = users.length > limit;
    const usersData = users.slice(0, limit);
    const nextCursor = hasMore ? users[limit].id : null;

    return res.json({
      success: true,
      data: {
        activities: usersData.map((u) => ({
          id: u.id,
          activityType: "USER",
          createdAt: u.createdAt.getTime(),
          entityId: u.id,
          entity: formatUser(u),
        })),
        total: usersData.length,
        hasMore,
        nextCursor,
      },
    });
  } catch (error) {
    console.error("Erreur dans searchUsers:", error);
    return res.json({
      success: false,
      message: "Une erreur est survenue. Veuillez réessayer.",
    });
  }
}

// ============================================================================
// ENDPOINT: GET /api/search/hashtags - RECHERCHE SPÉCIFIQUE DE HASHTAGS
// ============================================================================

export async function searchHashtags(req: Request, res: Response) {
  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "invalid_session",
      });
    }

    const rawQuery = ((req.query.q as string) || "").trim();
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    if (!rawQuery) {
      return res.json({
        success: false,
        message: "Paramètre 'q' requis",
      });
    }

    const cleanQuery = rawQuery.replace(/^#/, "");
    const searchPattern = `#${cleanQuery}`;

    const visibilityWhere: Prisma.PostWhereInput = {
      OR: [
        { userId: user.id },
        {
          visibility: "FOLLOWERS",
          user: {
            followers: {
              some: { followerId: user.id },
            },
          },
        },
        { visibility: "PUBLIC" },
      ],
    };

    // Récupérer les posts contenant le hashtag demandé
    const posts = await prisma.post.findMany({
      where: {
        AND: [
          {
            content: {
              contains: searchPattern,
              mode: "insensitive",
            },
          },
          visibilityWhere,
        ],
      },
      select: {
        content: true,
        _count: {
          select: {
            likes: true,
          },
        },
      },
      take: 500,
    });

    // Extraire et grouper les hashtags correspondants
    const hashtagMap = new Map<
      string,
      { hashtag: string; postCount: number; likeCount: number }
    >();

    posts.forEach((post) => {
      const tags = extractHashtags(post.content);
      tags.forEach((tag) => {
        if (tag.toLowerCase().includes(cleanQuery.toLowerCase())) {
          const key = tag.toLowerCase();
          const existing = hashtagMap.get(key);
          if (existing) {
            existing.postCount += 1;
            existing.likeCount += post._count.likes;
          } else {
            hashtagMap.set(key, {
              hashtag: tag,
              postCount: 1,
              likeCount: post._count.likes,
            });
          }
        }
      });
    });

    // Trier par nombre de posts décroissant
    const hashtags = Array.from(hashtagMap.values())
      .sort((a, b) => b.postCount - a.postCount)
      .slice(0, limit);

    return res.json({
      success: true,
      data: {
        activities: hashtags.map((h) => ({
          id: h.hashtag,
          activityType: "HASHTAG",
          createdAt: Date.now(),
          entityId: h.hashtag,
          entity: h,
        })),
        total: hashtags.length,
        hasMore: false,
      },
    });
  } catch (error) {
    console.error("Erreur dans searchHashtags:", error);
    return res.json({
      success: false,
      message: "Une erreur est survenue. Veuillez réessayer.",
    });
  }
}

// ============================================================================
// HISTORIQUE DE RECHERCHE
// ============================================================================

export async function getSearchHistory(req: Request, res: Response) {
  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "invalid_session",
      });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const cursor = req.query.cursor as string | undefined;

    const searches = await prisma.searchHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
    });

    const hasMore = searches.length > limit;
    const searchesData = searches.slice(0, limit);
    const nextCursor = hasMore ? searches[limit].id : null;

    return res.json({
      success: true,
      data: {
        activities: searchesData.map((s) => ({
          id: s.id,
          activityType: "SEARCH_PERFORMED",
          createdAt: s.createdAt.getTime(),
          entityId: s.id,
          entity: {
            id: s.id,
            query: s.query,
            createdAt: s.createdAt.getTime(),
          },
        })),
        total: searchesData.length,
        hasMore,
        nextCursor,
      },
    });
  } catch (error) {
    console.error("Erreur dans getSearchHistory:", error);
    return res.json({
      success: false,
      message: "Une erreur est survenue. Veuillez réessayer.",
    });
  }
}

export async function saveSearchQuery(req: Request, res: Response) {
  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "invalid_session",
      });
    }

    const { query } = req.body as { query?: string };
    if (!query || !query.trim()) {
      return res.json({
        success: false,
        message: "Le paramètre 'query' est requis",
      });
    }

    const trimmedQuery = query.trim();

    const existingEntry = await prisma.searchHistory.findFirst({
      where: {
        userId: user.id,
        query: trimmedQuery,
      },
    });

    if (existingEntry) {
      await prisma.searchHistory.update({
        where: { id: existingEntry.id },
        data: { createdAt: new Date() },
      });
      return res.json({
        success: true,
        data: {
          id: existingEntry.id,
          query: existingEntry.query,
          createdAt: Date.now(),
        },
      });
    }

    const newEntry = await prisma.searchHistory.create({
      data: {
        userId: user.id,
        query: trimmedQuery,
      },
    });

    return res.json({
      success: true,
      data: {
        id: newEntry.id,
        query: newEntry.query,
        createdAt: newEntry.createdAt.getTime(),
      },
    });
  } catch (error) {
    console.error("Erreur dans saveSearchQuery:", error);
    return res.json({
      success: false,
      message: "Une erreur est survenue. Veuillez réessayer.",
    });
  }
}

export async function deleteSearchQuery(req: Request, res: Response) {
  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "invalid_session",
      });
    }

    const searchId = req.params.queryId as string;
    if (!searchId) {
      return res.json({
        success: false,
        message: "L'ID de la recherche est requis",
      });
    }

    const entry = await prisma.searchHistory.findUnique({
      where: { id: searchId },
    });

    if (!entry || entry.userId !== user.id) {
      return res.json({
        success: false,
        message: "Entrée d'historique de recherche non trouvée.",
      });
    }

    await prisma.searchHistory.delete({
      where: { id: searchId },
    });

    return res.json({
      success: true,
      message: "Historique de recherche supprimé avec succès.",
    });
  } catch (error) {
    console.error("Erreur dans deleteSearchQuery:", error);
    return res.json({
      success: false,
      message: "Une erreur est survenue. Veuillez réessayer.",
    });
  }
}

export async function searchPosts(req: Request, res: Response) {
  return searchPostsFiltered(req, res);
}

export async function searchAll(req: Request, res: Response) {
  return searchGeneral(req, res);
}

export async function searchPost(req: Request, res: Response) {
  const q = req.query.q as string;
  const cursor = req.query.cursor as string | undefined;
  req.query = { ...req.query, q, cursor };
  return searchPostsFiltered(req, res);
}

export async function searchPostIds(req: Request, res: Response) {
  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "invalid_session",
      });
    }

    const q = (req.query.q as string) || "";
    if (!q) {
      return res.json({
        success: false,
        message: "Paramètre 'q' requis",
      });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const cursor = (req.query.cursor as string) || undefined;
     const visibilityWhere: Prisma.PostWhereInput = {
      OR: [
        { userId: user.id },
        {
          visibility: "FOLLOWERS",
          user: {
            followers: {
              some: { followerId: user.id },
            },
          },
        },
        { visibility: "PUBLIC" },
      ],
    };

    const whereClause: Prisma.PostWhereInput = {
        content: {
          contains: q,
          mode: "insensitive",
        },

    }

    const posts = await prisma.post.findMany({
      where: {
        AND: [visibilityWhere, whereClause]
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      select: { id: true },
    });

    const hasMore = posts.length > limit;
    const nextCursor = hasMore ? posts[limit].id : null;

    return res.json({
      success: true,
      data: {
        posts: posts.slice(0, limit).map((p) => p.id),
        nextCursor,
      },
    });
  } catch (error) {
    console.error(error);
    return res.json({
      success: false,
      message: "Une erreur est survenue. Veuillez réessayer.",
    });
  }
}
