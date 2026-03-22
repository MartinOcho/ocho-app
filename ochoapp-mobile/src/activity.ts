import { Request, Response } from "express";
import  prisma  from "./prisma";
import {
  ActivityType,
  ActivityItem,
  ActivityHistoryResponse,
  ActivityHistoryRequest,
  Post,
  Comment,
  User,
  SearchHistory,
  PostData
} from "./types";
import { getPostDataIncludes, getUserDataSelect } from "./types";
import { getCurrentUser } from "./auth";

class ActivityAggregationService {
  /**
   * Récupère l'historique d'activité d'un utilisateur
   */
  async getUserActivityHistory(
    userId: string,
    options: {
      limit?: number;
      cursor?: string;
      type?: ActivityType;
      startDate?: number;
      endDate?: number;
    } = {}
  ): Promise<ActivityHistoryResponse> {
    const { limit = 50, cursor, type, startDate, endDate } = options;

    // Récupérer toutes les activités en parallèle
    const activitiesPromises = [
      this.getUserPosts(userId, { limit, cursor, startDate, endDate }),
      this.getUserLikes(userId, { limit, cursor, startDate, endDate }),
      this.getUserComments(userId, { limit, cursor, startDate, endDate }),
      this.getUserBookmarks(userId, { limit, cursor, startDate, endDate }),
      this.getUserRoomJoins(userId, { limit, cursor, startDate, endDate }),
      this.getUserRoomLeaves(userId, { limit, cursor, startDate, endDate }),
      this.getUserRoomCreations(userId, { limit, cursor, startDate, endDate }),
      this.getUserSearches(userId, { limit, cursor, startDate, endDate }),
    ];

    // Si un type spécifique est demandé, ne récupérer que ce type
    if (type) {
      const typeMap = {
        POST_CREATED: this.getUserPosts,
        POST_LIKED: this.getUserLikes,
        POST_BOOKMARKED: this.getUserBookmarks,
        COMMENT_CREATED: this.getUserComments,
        COMMENT_LIKED: () => Promise.resolve([]), // TODO: implémenter
        ROOM_JOINED: this.getUserRoomJoins,
        ROOM_LEFT: this.getUserRoomLeaves,
        ROOM_CREATED: this.getUserRoomCreations,
        SEARCH_PERFORMED: this.getUserSearches,
      };

      const activities = await typeMap[type](userId, { limit, cursor, startDate, endDate });
      return {
        activities,
        total: activities.length,
        hasMore: activities.length === limit,
      };
    }

    // Récupérer toutes les activités
    const activitiesArrays = await Promise.all(activitiesPromises);
    const allActivities = activitiesArrays.flat();

    // Trier par date décroissante
    allActivities.sort((a, b) => b.createdAt - a.createdAt);

    // Appliquer la pagination par curseur
    let paginatedActivities = allActivities;
    let hasMore = false;
    let nextCursor: string | undefined;

    if (cursor) {
      // Trouver l'index du curseur
      const cursorIndex = allActivities.findIndex(a => a.id === cursor);
      if (cursorIndex !== -1) {
        // Prendre les éléments après le curseur
        paginatedActivities = allActivities.slice(cursorIndex + 1, cursorIndex + 1 + limit);
        hasMore = cursorIndex + 1 + limit < allActivities.length;
        nextCursor = hasMore ? paginatedActivities[paginatedActivities.length - 1]?.id : undefined;
      } else {
        // Curseur non trouvé, recommencer du début
        paginatedActivities = allActivities.slice(0, limit);
        hasMore = allActivities.length > limit;
        nextCursor = hasMore ? paginatedActivities[paginatedActivities.length - 1]?.id : undefined;
      }
    } else {
      paginatedActivities = allActivities.slice(0, limit);
      hasMore = allActivities.length > limit;
      nextCursor = hasMore ? paginatedActivities[paginatedActivities.length - 1]?.id : undefined;
    }

    return {
      activities: paginatedActivities,
      total: allActivities.length,
      hasMore,
      nextCursor,
    };
  }

  /**
   * Récupère les posts créés par l'utilisateur
   */
  async getUserPosts(
    userId: string,
    options: { limit?: number; cursor?: string; startDate?: number; endDate?: number }
  ): Promise<ActivityItem[]> {
    const { limit = 50, cursor, startDate, endDate } = options;

    const where: any = { userId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Utiliser la pagination par curseur si un curseur est fourni
    if (cursor && cursor.startsWith('post_')) {
      const cursorId = cursor.replace('post_', '');
      where.id = { lt: cursorId };
    }

    const posts = await prisma.post.findMany({
      where,
      include: getPostDataIncludes(userId),
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return posts.map((post: PostData) => {
      // Convertir PostData vers Post selon le pattern utilisé dans posts.ts
      const convertedPost: Post = {
        id: post.id,
        author: {
          id: post.user.id,
          username: post.user.username,
          displayName: post.user.displayName,
          avatarUrl: post.user.avatarUrl,
          bio: post.user.bio,
          verified: post.user.verified.length > 0 ? {
            verified: true,
            type: post.user.verified[0].type,
            expiresAt: post.user.verified[0].expiresAt?.getTime() || null,
          } : null,
          createdAt: post.user.createdAt?.getTime(),
          lastSeen: post.user.lastSeen?.getTime(),
          followersCount: post.user._count?.followers,
          postsCount: post.user._count?.posts,
          isFollowing: post.user.followers?.some(f => f.followerId === userId) || false,
        },
        content: post.content,
        createdAt: post.createdAt.getTime(),
        attachments: post.attachments.map(att => ({
          type: att.type,
          url: att.url,
        })),
        gradient: post.gradient || undefined,
        likes: post._count.likes,
        comments: post._count.comments,
        isLiked: post.likes.length > 0,
        isBookmarked: post.bookmarks.length > 0,
      };

      return {
        id: `post_${post.id}`,
        activityType: "POST_CREATED" as ActivityType,
        createdAt: post.createdAt.getTime(),
        entityId: post.id,
        entity: convertedPost,
      };
    });
  }

  /**
   * Récupère les likes de l'utilisateur (via les notifications)
   */
  async getUserLikes(
    userId: string,
    options: { limit?: number; cursor?: string; startDate?: number; endDate?: number }
  ): Promise<ActivityItem[]> {
    const { limit = 50, cursor, startDate, endDate } = options;

    const where: any = {
      issuerId: userId,
      type: "LIKE",
    };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Utiliser la pagination par curseur si un curseur est fourni
    if (cursor && cursor.startsWith('like_')) {
      const cursorId = cursor.replace('like_', '');
      where.id = { lt: cursorId };
    }

    const notifications = await prisma.notification.findMany({
      where,
      include: {
        post: {
          include: getPostDataIncludes(userId),
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return notifications.map(notification => {
      // Convertir le post selon le même pattern
      const postData = notification.post as PostData;
      const convertedPost: Post = {
        id: postData.id,
        author: {
          id: postData.user.id,
          username: postData.user.username,
          displayName: postData.user.displayName,
          avatarUrl: postData.user.avatarUrl,
          bio: postData.user.bio,
          verified: postData.user.verified.length > 0 ? {
            verified: true,
            type: postData.user.verified[0].type,
            expiresAt: postData.user.verified[0].expiresAt?.getTime() || null,
          } : null,
          createdAt: postData.user.createdAt?.getTime(),
          lastSeen: postData.user.lastSeen?.getTime(),
          followersCount: postData.user._count?.followers,
          postsCount: postData.user._count?.posts,
          isFollowing: postData.user.followers?.some(f => f.followerId === userId) || false,
        },
        content: postData.content,
        createdAt: postData.createdAt.getTime(),
        attachments: postData.attachments.map(att => ({
          type: att.type,
          url: att.url,
        })),
        gradient: postData.gradient || undefined,
        likes: postData._count.likes,
        comments: postData._count.comments,
        isLiked: postData.likes.length > 0,
        isBookmarked: postData.bookmarks.length > 0,
      };

      return {
        id: `like_${notification.id}`,
        activityType: "POST_LIKED" as ActivityType,
        createdAt: notification.createdAt.getTime(),
        entityId: notification.postId!,
        entity: convertedPost,
      };
    });
  }

  /**
   * Récupère les commentaires créés par l'utilisateur
   */
  async getUserComments(
    userId: string,
    options: { limit?: number; cursor?: string; startDate?: number; endDate?: number }
  ): Promise<ActivityItem[]> {
    const { limit = 50, cursor, startDate, endDate } = options;

    const where: any = { userId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Utiliser la pagination par curseur si un curseur est fourni
    if (cursor && cursor.startsWith('comment_')) {
      const cursorId = cursor.replace('comment_', '');
      where.id = { lt: cursorId };
    }

    const comments = await prisma.comment.findMany({
      where,
      include: {
        user: {
          select: getUserDataSelect(userId),
        },
        post: {
          select: {
            id: true,
            content: true,
            user: {
              select: getUserDataSelect(userId),
            },
          },
        },
        _count: {
          select: {
            likes: true,
            replies: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return comments.map(comment => {
      const convertedComment: Comment = {
        id: comment.id,
        author: comment.user ? {
          id: comment.user.id,
          username: comment.user.username,
          displayName: comment.user.displayName,
          avatarUrl: comment.user.avatarUrl,
          verified: comment.user.verified.length > 0 ? {
            verified: true,
            type: comment.user.verified[0].type,
            expiresAt: comment.user.verified[0].expiresAt?.getTime() || null,
          } : null,
        } : null,
        content: comment.content,
        createdAt: comment.createdAt.getTime(),
        likes: comment._count.likes,
        isLiked: false, // TODO: vérifier si l'utilisateur a liké
        isLikedByAuthor: false,
        isRepliedByAuthor: false,
        postId: comment.postId,
        postAuthorId: comment.post.user?.id || '',
        replies: comment._count.replies,
      };

      return {
        id: `comment_${comment.id}`,
        activityType: "COMMENT_CREATED" as ActivityType,
        createdAt: comment.createdAt.getTime(),
        entityId: comment.id,
        entity: convertedComment,
      };
    });
  }

  /**
   * Récupère les bookmarks de l'utilisateur
   */
  async getUserBookmarks(
    userId: string,
    options: { limit?: number; cursor?: string; startDate?: number; endDate?: number }
  ): Promise<ActivityItem[]> {
    const { limit = 50, cursor, startDate, endDate } = options;

    const where: any = { userId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Utiliser la pagination par curseur si un curseur est fourni
    if (cursor && cursor.startsWith('bookmark_')) {
      const cursorId = cursor.replace('bookmark_', '');
      where.id = { lt: cursorId };
    }

    const bookmarks = await prisma.bookmark.findMany({
      where,
      include: {
        post: {
          include: getPostDataIncludes(userId),
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return bookmarks.map(bookmark => {
      // Convertir le post selon le même pattern
      const postData = bookmark.post as PostData;
      const convertedPost: Post = {
        id: postData.id,
        author: {
          id: postData.user.id,
          username: postData.user.username,
          displayName: postData.user.displayName,
          avatarUrl: postData.user.avatarUrl,
          bio: postData.user.bio,
          verified: postData.user.verified.length > 0 ? {
            verified: true,
            type: postData.user.verified[0].type,
            expiresAt: postData.user.verified[0].expiresAt?.getTime() || null,
          } : null,
          createdAt: postData.user.createdAt?.getTime(),
          lastSeen: postData.user.lastSeen?.getTime(),
          followersCount: postData.user._count?.followers,
          postsCount: postData.user._count?.posts,
          isFollowing: postData.user.followers?.some(f => f.followerId === userId) || false,
        },
        content: postData.content,
        createdAt: postData.createdAt.getTime(),
        attachments: postData.attachments.map(att => ({
          type: att.type,
          url: att.url,
        })),
        gradient: postData.gradient || undefined,
        likes: postData._count.likes,
        comments: postData._count.comments,
        isLiked: postData.likes.length > 0,
        isBookmarked: postData.bookmarks.length > 0,
      };

      return {
        id: `bookmark_${bookmark.id}`,
        activityType: "POST_BOOKMARKED" as ActivityType,
        createdAt: bookmark.createdAt.getTime(),
        entityId: bookmark.postId,
        entity: convertedPost,
      };
    });
  }

  /**
   * Récupère les rooms rejoints par l'utilisateur
   */
  async getUserRoomJoins(
    userId: string,
    options: { limit?: number; cursor?: string; startDate?: number; endDate?: number }
  ): Promise<ActivityItem[]> {
    const { limit = 50, cursor, startDate, endDate } = options;

    const where: any = {
      userId,
      leftAt: null, // Seulement les rooms actives
    };
    if (startDate || endDate) {
      where.joinedAt = {};
      if (startDate) where.joinedAt.gte = new Date(startDate);
      if (endDate) where.joinedAt.lte = new Date(endDate);
    }

    // Utiliser la pagination par curseur si un curseur est fourni
    if (cursor && cursor.startsWith('room_join_')) {
      const cursorId = cursor.replace('room_join_', '');
      where.id = { lt: cursorId };
    }

    const roomMembers = await prisma.roomMember.findMany({
      where,
      include: {
        room: {
          select: {
            id: true,
            name: true,
            isGroup: true,
            createdAt: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
      take: limit,
    });

    return roomMembers.map(member => ({
      id: `room_join_${member.id}`,
      activityType: "ROOM_JOINED" as ActivityType,
      createdAt: member.joinedAt.getTime(),
      entityId: member.roomId,
      entity: {
        id: member.room.id,
        name: member.room.name,
        isGroup: member.room.isGroup,
        createdAt: member.room.createdAt.getTime(),
      },
    }));
  }

  /**
   * Récupère les rooms quittées par l'utilisateur
   */
  async getUserRoomLeaves(
    userId: string,
    options: { limit?: number; cursor?: string; startDate?: number; endDate?: number }
  ): Promise<ActivityItem[]> {
    const { limit = 50, cursor, startDate, endDate } = options;

    const where: any = {
      userId,
      leftAt: { not: null }, // Seulement les rooms quittées
    };
    if (startDate || endDate) {
      where.leftAt = {};
      if (startDate) where.leftAt.gte = new Date(startDate);
      if (endDate) where.leftAt.lte = new Date(endDate);
    }

    // Utiliser la pagination par curseur si un curseur est fourni
    if (cursor && cursor.startsWith('room_leave_')) {
      const cursorId = cursor.replace('room_leave_', '');
      where.id = { lt: cursorId };
    }

    const roomMembers = await prisma.roomMember.findMany({
      where,
      include: {
        room: {
          select: {
            id: true,
            name: true,
            isGroup: true,
            createdAt: true,
          },
        },
      },
      orderBy: { leftAt: 'desc' },
      take: limit,
    });

    return roomMembers.map(member => ({
      id: `room_leave_${member.id}`,
      activityType: "ROOM_LEFT" as ActivityType,
      createdAt: member.leftAt!.getTime(),
      entityId: member.roomId,
      entity: {
        id: member.room.id,
        name: member.room.name,
        isGroup: member.room.isGroup,
        createdAt: member.room.createdAt.getTime(),
      },
    }));
  }

  /**
   * Récupère les rooms créées par l'utilisateur
   */
  async getUserRoomCreations(
    userId: string,
    options: { limit?: number; cursor?: string; startDate?: number; endDate?: number }
  ): Promise<ActivityItem[]> {
    const { limit = 50, cursor, startDate, endDate } = options;

    const where: any = {
      userId,
      type: "OWNER", // Seulement les rooms où l'utilisateur est propriétaire
    };
    if (startDate || endDate) {
      where.joinedAt = {};
      if (startDate) where.joinedAt.gte = new Date(startDate);
      if (endDate) where.joinedAt.lte = new Date(endDate);
    }

    // Utiliser la pagination par curseur si un curseur est fourni
    if (cursor && cursor.startsWith('room_create_')) {
      const cursorId = cursor.replace('room_create_', '');
      where.id = { lt: cursorId };
    }

    const roomMembers = await prisma.roomMember.findMany({
      where,
      include: {
        room: {
          select: {
            id: true,
            name: true,
            isGroup: true,
            createdAt: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
      take: limit,
    });

    return roomMembers.map(member => ({
      id: `room_create_${member.id}`,
      activityType: "ROOM_CREATED" as ActivityType,
      createdAt: member.joinedAt.getTime(),
      entityId: member.roomId,
      entity: {
        id: member.room.id,
        name: member.room.name,
        isGroup: member.room.isGroup,
        createdAt: member.room.createdAt.getTime(),
      },
    }));
  }
  async getUserSearches(
    userId: string,
    options: { limit?: number; cursor?: string; startDate?: number; endDate?: number }
  ): Promise<ActivityItem[]> {
    const { limit = 50, cursor, startDate, endDate } = options;

    const where: any = { userId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Utiliser la pagination par curseur si un curseur est fourni
    if (cursor && cursor.startsWith('search_')) {
      const cursorId = cursor.replace('search_', '');
      where.id = { lt: cursorId };
    }

    const searches = await prisma.searchHistory.findMany({
      where,
      select: {
        id: true,
        query: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return searches.map(search => ({
      id: `search_${search.id}`,
      activityType: "SEARCH_PERFORMED" as ActivityType,
      createdAt: search.createdAt.getTime(),
      entityId: search.id,
      entity: {
        ...search,
        createdAt: search.createdAt.getTime(),
      } as SearchHistory,
      metadata: { query: search.query },
    }));
  }
}

// Instance du service
const activityService = new ActivityAggregationService();

/**
 * GET /api/activity/posts
 * Récupère les posts créés par l'utilisateur
 */
export const getUserPostsActivity = async (req: Request, res: Response) => {
  try {
    const { user: currentUser, message } = await getCurrentUser(req.headers);
    if (!currentUser) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const userId = currentUser.id;
    const { limit, cursor, startDate, endDate } = req.query;

    const options = {
      limit: limit ? parseInt(limit as string) : undefined,
      cursor: cursor as string,
      startDate: startDate ? parseInt(startDate as string) : undefined,
      endDate: endDate ? parseInt(endDate as string) : undefined,
    };

    const activities = await activityService.getUserPosts(userId, options);

    res.json({
      success: true,
      data: {
        activities,
        total: activities.length,
        hasMore: activities.length === (options.limit || 50),
        nextCursor: activities.length > 0 ? activities[activities.length - 1]?.id : undefined,
      },
    });
  } catch (error) {
    console.error("Error fetching user posts:", error);
    res.json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/activity/likes
 * Récupère les posts likés par l'utilisateur
 */
export const getUserLikes = async (req: Request, res: Response) => {
  try {
    const { user: currentUser, message } = await getCurrentUser(req.headers);
    if (!currentUser) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const userId = currentUser.id;
    const { limit, cursor, startDate, endDate } = req.query;

    const options = {
      limit: limit ? parseInt(limit as string) : undefined,
      cursor: cursor as string,
      startDate: startDate ? parseInt(startDate as string) : undefined,
      endDate: endDate ? parseInt(endDate as string) : undefined,
    };

    const activities = await activityService.getUserLikes(userId, options);

    res.json({
      success: true,
      data: {
        activities,
        total: activities.length,
        hasMore: activities.length === (options.limit || 50),
        nextCursor: activities.length > 0 ? activities[activities.length - 1]?.id : undefined,
      },
    });
  } catch (error) {
    console.error("Error fetching user likes:", error);
    res.json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/activity/bookmarks
 * Récupère les posts sauvegardés par l'utilisateur
 */
export const getUserBookmarks = async (req: Request, res: Response) => {
  try {
    const { user: currentUser, message } = await getCurrentUser(req.headers);
    if (!currentUser) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const userId = currentUser.id;
    const { limit, cursor, startDate, endDate } = req.query;

    const options = {
      limit: limit ? parseInt(limit as string) : undefined,
      cursor: cursor as string,
      startDate: startDate ? parseInt(startDate as string) : undefined,
      endDate: endDate ? parseInt(endDate as string) : undefined,
    };

    const activities = await activityService.getUserBookmarks(userId, options);

    res.json({
      success: true,
      data: {
        activities,
        total: activities.length,
        hasMore: activities.length === (options.limit || 50),
        nextCursor: activities.length > 0 ? activities[activities.length - 1]?.id : undefined,
      },
    });
  } catch (error) {
    console.error("Error fetching user bookmarks:", error);
    res.json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/activity/comments
 * Récupère les commentaires créés par l'utilisateur
 */
export const getUserComments = async (req: Request, res: Response) => {
  try {
    const { user: currentUser, message } = await getCurrentUser(req.headers);
    if (!currentUser) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const userId = currentUser.id;
    const { limit, cursor, startDate, endDate } = req.query;

    const options = {
      limit: limit ? parseInt(limit as string) : undefined,
      cursor: cursor as string,
      startDate: startDate ? parseInt(startDate as string) : undefined,
      endDate: endDate ? parseInt(endDate as string) : undefined,
    };

    const activities = await activityService.getUserComments(userId, options);

    res.json({
      success: true,
      data: {
        activities,
        total: activities.length,
        hasMore: activities.length === (options.limit || 50),
        nextCursor: activities.length > 0 ? activities[activities.length - 1]?.id : undefined,
      },
    });
  } catch (error) {
    console.error("Error fetching user comments:", error);
    res.json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/activity/rooms/joined
 * Récupère les rooms rejoints par l'utilisateur
 */
export const getUserRoomJoins = async (req: Request, res: Response) => {
  try {
    const { user: currentUser, message } = await getCurrentUser(req.headers);
    if (!currentUser) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const userId = currentUser.id;
    const { limit, cursor, startDate, endDate } = req.query;

    const options = {
      limit: limit ? parseInt(limit as string) : undefined,
      cursor: cursor as string,
      startDate: startDate ? parseInt(startDate as string) : undefined,
      endDate: endDate ? parseInt(endDate as string) : undefined,
    };

    const activities = await activityService.getUserRoomJoins(userId, options);

    res.json({
      success: true,
      data: {
        activities,
        total: activities.length,
        hasMore: activities.length === (options.limit || 50),
        nextCursor: activities.length > 0 ? activities[activities.length - 1]?.id : undefined,
      },
    });
  } catch (error) {
    console.error("Error fetching user room joins:", error);
    res.json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/activity/rooms/left
 * Récupère les rooms quittées par l'utilisateur
 */
export const getUserRoomLeaves = async (req: Request, res: Response) => {
  try {
    const { user: currentUser, message } = await getCurrentUser(req.headers);
    if (!currentUser) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const userId = currentUser.id;
    const { limit, cursor, startDate, endDate } = req.query;

    const options = {
      limit: limit ? parseInt(limit as string) : undefined,
      cursor: cursor as string,
      startDate: startDate ? parseInt(startDate as string) : undefined,
      endDate: endDate ? parseInt(endDate as string) : undefined,
    };

    const activities = await activityService.getUserRoomLeaves(userId, options);

    res.json({
      success: true,
      data: {
        activities,
        total: activities.length,
        hasMore: activities.length === (options.limit || 50),
        nextCursor: activities.length > 0 ? activities[activities.length - 1]?.id : undefined,
      },
    });
  } catch (error) {
    console.error("Error fetching user room leaves:", error);
    res.json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/activity/rooms/created
 * Récupère les rooms créées par l'utilisateur
 */
export const getUserRoomCreations = async (req: Request, res: Response) => {
  try {
    const { user: currentUser, message } = await getCurrentUser(req.headers);
    if (!currentUser) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const userId = currentUser.id;
    const { limit, cursor, startDate, endDate } = req.query;

    const options = {
      limit: limit ? parseInt(limit as string) : undefined,
      cursor: cursor as string,
      startDate: startDate ? parseInt(startDate as string) : undefined,
      endDate: endDate ? parseInt(endDate as string) : undefined,
    };

    const activities = await activityService.getUserRoomCreations(userId, options);

    res.json({
      success: true,
      data: {
        activities,
        total: activities.length,
        hasMore: activities.length === (options.limit || 50),
        nextCursor: activities.length > 0 ? activities[activities.length - 1]?.id : undefined,
      },
    });
  } catch (error) {
    console.error("Error fetching user room creations:", error);
    res.json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/activity/searches
 * Récupère les recherches effectuées par l'utilisateur
 */
export const getUserSearches = async (req: Request, res: Response) => {
  try {
    const { user: currentUser, message } = await getCurrentUser(req.headers);
    if (!currentUser) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const userId = currentUser.id;
    const { limit, cursor, startDate, endDate } = req.query;

    const options = {
      limit: limit ? parseInt(limit as string) : undefined,
      cursor: cursor as string,
      startDate: startDate ? parseInt(startDate as string) : undefined,
      endDate: endDate ? parseInt(endDate as string) : undefined,
    };

    const activities = await activityService.getUserSearches(userId, options);

    res.json({
      success: true,
      data: {
        activities,
        total: activities.length,
        hasMore: activities.length === (options.limit || 50),
        nextCursor: activities.length > 0 ? activities[activities.length - 1]?.id : undefined,
      },
    });
  } catch (error) {
    console.error("Error fetching user searches:", error);
    res.json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * GET /api/activity/history
 * Récupère l'historique d'activité d'un utilisateur
 */
export const getActivityHistory = async (req: Request, res: Response) => {
  try {
    // Vérifier l'authentification de l'utilisateur
    const { user: currentUser, message } = await getCurrentUser(req.headers);
    if (!currentUser) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const userId = currentUser.id;
    const { limit, cursor, type, startDate, endDate } = req.query;

    if (!userId) {
      return res.json({
        success: false,
        message: "userId is required",
      });
    }

    // Vérifier que l'utilisateur ne demande que son propre historique
    if (userId !== currentUser.id) {
      return res.json({
        success: false,
        message: "Vous ne pouvez voir que votre propre historique d'activité.",
        name: "forbidden",
      });
    }

    const options: ActivityHistoryRequest = {
      userId,
      limit: limit ? parseInt(limit as string) : undefined,
      cursor: cursor as string,
      type: type as ActivityType,
      startDate: startDate ? parseInt(startDate as string) : undefined,
      endDate: endDate ? parseInt(endDate as string) : undefined,
    };

    const result = await activityService.getUserActivityHistory(userId, options);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error fetching activity history:", error);
    res.json({
      success: false,
      message: "Internal server error",
    });
  }
};

export default {
  getActivityHistory,
  getUserPostsActivity,
  getUserLikes,
  getUserBookmarks,
  getUserComments,
  getUserRoomJoins,
  getUserRoomLeaves,
  getUserRoomCreations,
  getUserSearches,
};