import { Request, Response } from "express";
import prisma from "./prisma";
import { getPostDataIncludes, getUserDataSelect, PostData, User, UserData, VerifiedUser } from "./types";
import { checkVerification, getCurrentUser } from "./auth";

export function calculateRelevanceScore(
  post: PostData,
  user: UserData,
  latestPostId?: string,
): number {
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
}

export async function getPost(req: Request, res: Response) {
  const { postId } = req.params;
  try {
    const { user: currentUser, message } = await getCurrentUser(req.headers);
    if (!currentUser) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: getUserDataSelect(currentUser.id),
    });

    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const [allScores, post] = await prisma.$transaction([
      prisma.postUserScore.findMany({
        where: {
          postId: postId,
        },
        select: {
          userId: true,
          relevanceScore: true,
        },
      }),
      prisma.post.findUnique({
        where: {
          id: postId,
        },
        include: getPostDataIncludes(user.id),
      }),
    ]);

    if (!allScores || !post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    const newUserScore = calculateRelevanceScore(post, user);

    const postScore =
      newUserScore +
      allScores
        .filter((score) => score.userId !== user.id)
        .reduce((acc, score) => acc + score?.relevanceScore, 0);

    await prisma.$transaction([
      prisma.post.update({
        where: {
          id: postId,
        },
        data: {
          relevanceScore: postScore,
        },
      }),
      prisma.postUserScore.upsert({
        where: {
          postId_userId: {
            postId,
            userId: user.id,
          },
        },
        update: {
          relevanceScore: newUserScore,
        },
        create: {
          postId,
          userId: user.id,
          relevanceScore: newUserScore,
        },
      }),
    ]);

    const userVerifiedData = post.user.verified?.[0];
    const expiresAt = userVerifiedData?.expiresAt?.getTime() || null;
    const canExpire = !!(expiresAt || null);

    const expired =
      canExpire && expiresAt ? new Date().getTime() < expiresAt : false;

    const isVerified = !!userVerifiedData && !expired;

    const verified: VerifiedUser = {
      verified: isVerified,
      type: userVerifiedData?.type,
      expiresAt,
    };

    const author: User = {
      id: post.userId,
      username: post.user.username,
      displayName: post.user.displayName,
      avatarUrl: post.user.avatarUrl || undefined,
      bio: post.user.bio || undefined,
      verified,
      createdAt: post.user.createdAt.getTime(),
      lastSeen: post.user.lastSeen.getTime(),
    };

    const createdAt: number = post.createdAt.getTime();
    const content: string = post.content;
    const gradient: number | undefined = post.gradient || undefined;
    const id: string = post.id;
    const likes = post._count.likes;
    const comments = post._count.comments;
    const isLiked = post.likes.length > 0;
    const isBookmarked = post.bookmarks.length > 0;

    const finalPost = {
      id,
      author,
      content,
      createdAt,
      attachments: post.attachments,
      gradient,
      likes,
      comments,
      isLiked,
      isBookmarked,
    };

    return res.json({
      success: true,
      data: finalPost,
    });
  } catch (error) {
    console.error("Error getting post:", error);
    return res.json({
      success: false,
      message: "Erreur lors de la récupération du post",
    });
  }
}

export async function deletePost(req: Request, res: Response) {
  const { postId } = req.params;
  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    if (!postId) {
      return res.json({ success: false, message: "ID de post manquant" });
    }

    const postToDelete = await prisma.post.findUnique({
      where: {
        id: postId,
      },
    });

    if (!postToDelete) {
      return res
        .status(404)
        .json({ success: false, message: "Post non trouvé" });
    }

    if (postToDelete.userId !== user.id) {
      return res.json({
        success: false,
        message: "Vous n'avez pas la permission de supprimer ce post",
      });
    }

    await prisma.post.delete({
      where: {
        id: postId,
      },
    });

    return res.json({
      success: true,
      message: "Post supprimé avec succès",
    });
  } catch (error) {
    console.error("Error deleting post:", error);
    return res.json({
      success: false,
      message: "Erreur lors de la suppression du post",
    });
  }
}

export async function toggleLike(req: Request, res: Response) {
  const { postId } = req.params;
  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const userId = user.id;
    let isLiked = false;

    await prisma.$transaction(async (prisma) => {
      const existingLike = await prisma.like.findFirst({
        where: { postId: postId, userId: userId },
      });

      if (existingLike) {
        await prisma.like.delete({
          where: {
            userId_postId: { userId, postId },
          },
        });
        isLiked = false;
      } else {
        await prisma.like.create({
          data: {
            postId: postId,
            userId: userId,
          },
        });

        const post = await prisma.post.findUnique({
          where: { id: postId },
          select: { userId: true },
        });

        if (post && post.userId !== userId) {
          await prisma.notification.create({
            data: {
              issuerId: userId,
              recipientId: post.userId,
              type: "LIKE",
              postId: postId,
            },
          });
        }

        isLiked = true;
      }
    });

    const likesCount = await prisma.like.count({
      where: { postId: postId },
    });

    return res.json({
      success: true,
      message: "Like action successful.",
      data: { isLiked, likes: likesCount },
    });
  } catch (error) {
    console.error("Error in like endpoint:", error);
    return res.json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
}

export async function toggleBookmark(req: Request, res: Response) {
  const { postId } = req.params;
  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const userId = user.id;
    let isBookmarked = false;

    await prisma.$transaction(async (prisma) => {
      const existingBookmark = await prisma.bookmark.findUnique({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
      });

      if (existingBookmark) {
        await prisma.bookmark.delete({
          where: {
            userId_postId: { userId, postId },
          },
        });
        isBookmarked = false;
      } else {
        await prisma.bookmark.create({
          data: {
            postId,
            userId,
          },
        });

        isBookmarked = true;
      }
    });

    return res.json({
      success: true,
      message: "Post bookmarked successfully.",
      data: { isBookmarked },
    });
  } catch (error) {
    console.error("Error in bookmark endpoint:", error);
    return res.json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
}

export async function getPostsForYou(req: Request, res: Response) {
  try {
    const { user: currentUser, message } = await getCurrentUser(req.headers);
    if (!currentUser) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: getUserDataSelect(currentUser.id),
    });

    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const cursor = req.query.cursor as string | undefined;
    const pageSize = 5;

    // Récupérer les trois derniers posts triés par date
    const latestPosts = await prisma.post.findMany({
      include: getPostDataIncludes(user.id),
      orderBy: { createdAt: "desc" },
      take: !cursor ? 3 : 0,
    });

    // Récupérer les posts suivants triés par pertinence
    const relevantPosts = await prisma.post.findMany({
      include: getPostDataIncludes(user.id),
      orderBy: [
        { relevanceScore: "desc" },
        { createdAt: "desc" },
      ],
      take: pageSize + 1,
      cursor: cursor ? { id: cursor } : undefined,
      where: {
        id: {
          notIn: latestPosts.map((p) => p.id),
        },
      },
    });

    const allPosts = [...latestPosts, ...relevantPosts];

    const sortedPosts = allPosts
      .slice(0, pageSize)
      .map((post) => {
        const relevance = calculateRelevanceScore(
          post,
          user,
          allPosts[0]?.id,
        );

        const userVerifiedData = post.user.verified?.[0];
        const expiresAt = userVerifiedData?.expiresAt?.getTime() || null;
        const canExpire = !!(expiresAt || null);
        const expired =
          canExpire && expiresAt ? new Date().getTime() < expiresAt : false;
        const isVerified = !!userVerifiedData && !expired;

        const verified: VerifiedUser = {
          verified: isVerified,
          type: userVerifiedData?.type,
          expiresAt,
        };

        const author: User = {
          id: post.userId,
          username: post.user.username,
          displayName: post.user.displayName,
          avatarUrl: post.user.avatarUrl || undefined,
          bio: post.user.bio || undefined,
          verified,
          createdAt: post.user.createdAt.getTime(),
          lastSeen: post.user.lastSeen.getTime(),
        };

        return {
          relevance,
          post: {
            id: post.id,
            author,
            content: post.content,
            createdAt: post.createdAt.getTime(),
            attachments: post.attachments,
            gradient: post.gradient || undefined,
            likes: post._count.likes,
            comments: post._count.comments,
            isLiked: post.likes.length > 0,
            isBookmarked: post.bookmarks.some((b) => b.userId === user.id),
          },
        };
      })
      .sort((a, b) => b.relevance - a.relevance)
      .map((item) => item.post);

    const nextCursor = allPosts.length > pageSize + latestPosts.length
      ? allPosts[pageSize + latestPosts.length].id
      : null;

    return res.json({
      success: true,
      message: "Posts retrieved successfully",
      data: {
        posts: sortedPosts,
        nextCursor,
      },
    });
  } catch (error) {
    console.error(error);
    return res.json({
      success: false,
      message: "Internal server error",
      name: "server-error",
    });
  }
}

export async function getFollowingPosts(req: Request, res: Response) {
  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const cursor = req.query.cursor as string | undefined;
    const pageSize = 5;

    const posts = await prisma.post.findMany({
      where: {
        AND: [
          {
            user: {
              followers: {
                some: {
                  followerId: user.id,
                },
              },
              NOT: {
                id: user.id,
              },
            },
          },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            createdAt: true,
            lastSeen: true,
            verified: {
              select: { type: true, expiresAt: true },
            },
            followers: {
              where: { followerId: user.id },
              select: { followerId: true },
            },
          },
        },
        attachments: true,
        likes: {
          where: { userId: user.id },
          select: { userId: true },
        },
        bookmarks: {
          select: { userId: true },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
      cursor: cursor ? { id: cursor } : undefined,
    });

    const sortedPosts = posts.slice(0, pageSize).map((post) => {
      const userVerifiedData = post.user.verified?.[0];
      const expiresAt = userVerifiedData?.expiresAt?.getTime() || null;
      const canExpire = !!(expiresAt || null);
      const expired =
        canExpire && expiresAt ? new Date().getTime() < expiresAt : false;
      const isVerified = !!userVerifiedData && !expired;

      const verified: VerifiedUser = {
        verified: isVerified,
        type: userVerifiedData?.type,
        expiresAt,
      };

      const author: User = {
        id: post.userId,
        username: post.user.username,
        displayName: post.user.displayName,
        avatarUrl: post.user.avatarUrl || undefined,
        bio: post.user.bio || undefined,
        verified,
        createdAt: post.user.createdAt.getTime(),
        lastSeen: post.user.lastSeen.getTime(),
      };

      return {
        id: post.id,
        author,
        content: post.content,
        createdAt: post.createdAt.getTime(),
        attachments: post.attachments,
        gradient: post.gradient || undefined,
        likes: post._count.likes,
        comments: post._count.comments,
        isLiked: post.likes.length > 0,
        isBookmarked: post.bookmarks.some((b) => b.userId === user.id),
      };
    });

    const nextCursor = posts.length > pageSize ? posts[pageSize].id : null;

    return res.json({
      success: true,
      message: "Posts retrieved successfully",
      data: {
        posts: sortedPosts,
        nextCursor,
      },
    });
  } catch (error) {
    console.error(error);
    return res.json({
      success: false,
      message: "Internal server error",
      name: "server-error",
    });
  }
}

export async function getBookmarkedPosts(req: Request, res: Response) {
  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const cursor = req.query.cursor as string | undefined;
    const pageSize = 5;

    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: user.id },
      include: {
        post: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                bio: true,
                createdAt: true,
                lastSeen: true,
                verified: {
                  select: { type: true, expiresAt: true },
                },
              },
            },
            attachments: true,
            likes: {
              where: { userId: user.id },
              select: { userId: true },
            },
            bookmarks: {
              select: { userId: true },
            },
            _count: {
              select: {
                likes: true,
                comments: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
      cursor: cursor ? { id: cursor } : undefined,
    });

    const posts = bookmarks.map((b) => b.post);

    const finalPosts = posts.slice(0, pageSize).map((post) => {
      const userVerifiedData = post.user.verified?.[0];
      const expiresAt = userVerifiedData?.expiresAt?.getTime() || null;
      const canExpire = !!(expiresAt || null);
      const expired =
        canExpire && expiresAt ? new Date().getTime() < expiresAt : false;
      const isVerified = !!userVerifiedData && !expired;

      const verified: VerifiedUser = {
        verified: isVerified,
        type: userVerifiedData?.type,
        expiresAt,
      };

      const author: User = {
        id: post.userId,
        username: post.user.username,
        displayName: post.user.displayName,
        avatarUrl: post.user.avatarUrl || undefined,
        bio: post.user.bio || undefined,
        verified,
        createdAt: post.user.createdAt.getTime(),
        lastSeen: post.user.lastSeen.getTime(),
      };

      return {
        id: post.id,
        author,
        content: post.content,
        createdAt: post.createdAt.getTime(),
        attachments: post.attachments,
        gradient: post.gradient || undefined,
        likes: post._count.likes,
        comments: post._count.comments,
        isLiked: post.likes.length > 0,
        isBookmarked: true,
      };
    });

    const nextCursor = bookmarks.length > pageSize ? bookmarks[pageSize].id : null;

    return res.json({
      success: true,
      message: "Posts retrieved successfully",
      data: {
        posts: finalPosts,
        nextCursor,
      },
    });
  } catch (error) {
    console.error(error);
    return res.json({
      success: false,
      message: "Internal server error",
      name: "server-error",
    });
  }
}

export async function createPost(req: Request, res: Response) {
  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const { content, mediaIds, gradient } = req.body;

    const post = await prisma.post.create({
      data: {
        content,
        userId: user.id,
        gradient,
        attachments: {
          connect: mediaIds?.map((id: string) => ({ id })) || [],
        },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            createdAt: true,
            lastSeen: true,
            verified: {
              select: { type: true, expiresAt: true },
            },
          },
        },
        attachments: true,
        likes: {
          where: { userId: user.id },
          select: { userId: true },
        },
        bookmarks: {
          where: { userId: user.id },
          select: { userId: true },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

    const userVerifiedData = post.user.verified?.[0];
    const expiresAt = userVerifiedData?.expiresAt?.getTime() || null;
    const canExpire = !!(expiresAt || null);
    const expired =
      canExpire && expiresAt ? new Date().getTime() < expiresAt : false;
    const isVerified = !!userVerifiedData && !expired;

    const verified: VerifiedUser = {
      verified: isVerified,
      type: userVerifiedData?.type,
      expiresAt,
    };

    const author: User = {
      id: post.userId,
      username: post.user.username,
      displayName: post.user.displayName,
      avatarUrl: post.user.avatarUrl || undefined,
      bio: post.user.bio || undefined,
      verified,
      createdAt: post.user.createdAt.getTime(),
      lastSeen: post.user.lastSeen.getTime(),
    };

    const newPost = {
      id: post.id,
      author,
      content: post.content,
      createdAt: post.createdAt.getTime(),
      attachments: post.attachments,
      gradient: post.gradient || undefined,
      likes: post._count.likes,
      comments: post._count.comments,
      isLiked: post.likes.length > 0,
      isBookmarked: post.bookmarks.length > 0,
    };

    return res.json({
      success: true,
      message: "Post publié avec succès.",
      data: newPost,
    });
  } catch (error) {
    console.error(error);
    return res.json({
      success: false,
      message: "Quelque chose s'est mal passé. Veuillez réessayer.",
    });
  }
}

export async function getUserPosts(req: Request, res: Response) {
  const { userId } = req.params;
  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const cursor = req.query.cursor as string | undefined;
    const pageSize = 5;

    const posts = await prisma.post.findMany({
      where: {
        OR: [{ userId }, { user: { username: userId } }],
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            createdAt: true,
            lastSeen: true,
            verified: {
              select: { type: true, expiresAt: true },
            },
          },
        },
        attachments: true,
        likes: {
          where: { userId: user.id },
          select: { userId: true },
        },
        bookmarks: {
          where: { userId: user.id },
          select: { userId: true },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
      cursor: cursor ? { id: cursor } : undefined,
    });

    const finalPosts = posts.slice(0, pageSize).map((post) => {
      const userVerifiedData = post.user.verified?.[0];
      const expiresAt = userVerifiedData?.expiresAt?.getTime() || null;
      const canExpire = !!(expiresAt || null);
      const expired =
        canExpire && expiresAt ? new Date().getTime() < expiresAt : false;
      const isVerified = !!userVerifiedData && !expired;

      const verified: VerifiedUser = {
        verified: isVerified,
        type: userVerifiedData?.type,
        expiresAt,
      };

      const author = {
        id: post.userId,
        username: post.user.username,
        displayName: post.user.displayName,
        avatarUrl: post.user.avatarUrl || undefined,
        bio: post.user.bio || undefined,
        verified,
        createdAt: post.user.createdAt.getTime(),
        lastSeen: post.user.lastSeen.getTime(),
      };

      const isBookmarked = post.bookmarks.length > 0;

      return {
        id: post.id,
        author,
        content: post.content,
        createdAt: post.createdAt.getTime(),
        attachments: post.attachments,
        gradient: post.gradient || undefined,
        likes: post._count.likes,
        comments: post._count.comments,
        isLiked: post.likes.length > 0,
        isBookmarked,
      };
    });

    const nextCursor = posts.length > pageSize ? posts[pageSize].id : null;

    return res.json({
      success: true,
      message: "Posts de l'utilisateur récupérés avec succès",
      data: {
        posts: finalPosts,
        nextCursor,
      },
    });
  } catch (error) {
    console.error(error);
    return res.json({
      success: false,
      message: "Quelque chose s'est mal passé. Veuillez réessayer.",
    });
  }
}