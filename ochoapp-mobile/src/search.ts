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

export async function getSearchHistory(req: Request, res: Response) {
  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({ success: false, message: message || "Utilisateur non authentifié.", name: "unauthorized" });
    }

    const history = await prisma.searchHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ success: true, data: history });
  } catch (error) {
    console.error(error);
    return res.json({ success: false, message: "Something went wrong. Please try again." });
  }
}

export async function saveSearchQuery(req: Request, res: Response) {
  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({ success: false, message: message || "Utilisateur non authentifié.", name: "unauthorized" });
    }

    const { query } = req.body as { query?: string };
    if (!query) {
      return res.status(400).json({ success: false, message: "Query is required" });
    }

    const newEntry = await prisma.searchHistory.create({
      data: { userId: user.id, query },
    });
    return res.json({ success: true, data: newEntry });
  } catch (error) {
    console.error(error);
    return res.json({ success: false, message: "Something went wrong. Please try again." });
  }
}

export async function deleteSearchQuery(req: Request, res: Response) {
  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({ success: false, message: message || "Utilisateur non authentifié.", name: "unauthorized" });
    }

    const queryId = req.params.queryId;
    if (!queryId) {
      return res.status(400).json({ success: false, message: "queryId is required" });
    }

    const entry = await prisma.searchHistory.findUnique({ where: { id: queryId } });
    if (!entry || entry.userId !== user.id) {
      return res.status(404).json({ success: false, message: "Search history item not found." });
    }

    await prisma.searchHistory.delete({ where: { id: queryId } });

    return res.json({ success: true, message: "Search history deleted." });
  } catch (error) {
    console.error(error);
    return res.json({ success: false, message: "Something went wrong. Please try again." });
  }
}

export async function searchAll(req: Request, res: Response) {
  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({ success: false, message: message || "Utilisateur non authentifié.", name: "unauthorized" });
    }

    const query = (req.query.q as string) || (req.query.query as string) || "";
    if (!query) {
      return res.status(400).json({ success: false, message: "q parameter is required" });
    }

    const posts = await prisma.post.findMany({
      where: {
        OR: [
          {
            content: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            user: {
              displayName: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
          {
            user: {
              username: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
        ],
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: "insensitive" } },
          { displayName: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 10,
      select: { id: true, username: true, displayName: true, avatarUrl: true },
      orderBy: { username: "asc" },
    });

    return res.json({ success: true, data: { posts, users } });
  } catch (error) {
    console.error(error);
    return res.json({ success: false, message: "Something went wrong. Please try again." });
  }
}

export async function searchPost(req: Request, res: Response) {
  const q = req.query.q as string;
  const cursor = req.query.cursor as string | undefined;
  req.query = { q, cursor };
  return searchPosts(req, res);
}

export async function searchPostIds(req: Request, res: Response) {
  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({ success: false, message: message || "Utilisateur non authentifié.", name: "unauthorized" });
    }

    const q = (req.query.q as string) || "";
    if (!q) {
      return res.status(400).json({ success: false, message: "q parameter is required" });
    }

    const pageSize = 10;
    const cursor = (req.query.cursor as string) || undefined;

    const queryString = q.split(" ").map((term) => `${term}:*`).join(" & ");

    const posts = await prisma.post.findMany({
      where: {
        OR: [
          { content: { search: queryString } },
          { user: { displayName: { search: queryString } } },
          { user: { username: { search: queryString } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
      cursor: cursor ? { id: cursor } : undefined,
      select: { id: true },
    });

    const nextCursor = posts.length > pageSize ? posts[pageSize].id : null;

    return res.json({ success: true, data: { posts: posts.slice(0, pageSize).map((p) => p.id), nextCursor } });
  } catch (error) {
    console.error(error);
    return res.json({ success: false, message: "Something went wrong. Please try again." });
  }
}
