import { Request, Response } from "express";
import prisma from "./prisma";
import { getCurrentUser } from "./auth";

export async function searchPosts(req: Request, res: Response) {
  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const query = req.query.q as string;
    const cursor = req.query.cursor as string | undefined;
    const pageSize = 10;

    if (!query) {
      return res.json({
        success: false,
        message: "Query parameter is required",
      });
    }

    const posts = await prisma.post.findMany({
      where: {
        content: {
          contains: query,
          mode: "insensitive",
        },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            verified: {
              select: {
                type: true,
                expiresAt: true,
              },
            },
          },
        },
        attachments: true,
        likes: {
          select: {
            userId: true,
          },
        },
        bookmarks: {
          select: {
            userId: true,
          },
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

    const postsData = posts.slice(0, pageSize).map((post) => ({
      id: post.id,
      author: {
        id: post.user.id,
        username: post.user.username,
        displayName: post.user.displayName,
        avatarUrl: post.user.avatarUrl,
        verified: {
          verified: !!post.user.verified?.[0],
          type: post.user.verified?.[0]?.type,
          expiresAt: post.user.verified?.[0]?.expiresAt?.getTime(),
        },
      },
      content: post.content,
      createdAt: post.createdAt.getTime(),
      attachments: post.attachments,
      gradient: post.gradient,
      likes: post._count.likes,
      comments: post._count.comments,
      isLiked: post.likes.some((like) => like.userId === user.id),
      isBookmarked: post.bookmarks.some((bookmark) => bookmark.userId === user.id),
    }));

    const nextCursor = posts.length > pageSize ? posts[pageSize].id : null;

    return res.json({
      success: true,
      message: "Search results retrieved successfully.",
      data: {
        posts: postsData,
        nextCursor,
      },
    });
  } catch (error) {
    console.error(error);
    return res.json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
}