import { validateRequest } from "@/auth";
import { calculateRelevanceScore } from "@/lib/postScore";
import prisma from "@/lib/prisma";
import { getPostDataIncludes, PostsPage } from "@/lib/types";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;

    const { user } = await validateRequest();

    if (!user) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    const pageSize = 10;

   
    // Récupérer les trois derniers posts triés par date
    const latestPosts = await prisma.post.findMany({
      include: getPostDataIncludes(user.id),
      orderBy: {
        createdAt: "desc",
      },
      take: !cursor ? 3 : 0,
    });

    // Récupérer d'abord les posts des auteurs suivis, puis un pool de posts populaires
    const followedPosts = await prisma.post.findMany({
      include: getPostDataIncludes(user.id),
      where: {
        AND: [
          {
            user: {
              followers: {
                some: { followerId: user.id },
              },
            },
          },
          {
            id: { notIn: latestPosts.map((post) => post.id) },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: pageSize * 3,
    });

    const popularPosts = await prisma.post.findMany({
      include: getPostDataIncludes(user.id),
      where: {
        id: { notIn: [...latestPosts, ...followedPosts].map((post) => post.id) },
      },
      orderBy: { relevanceScore: "desc" },
      take: pageSize * 3,
    });

    const posts = [...latestPosts, ...followedPosts, ...popularPosts];
    const uniquePosts = Array.from(new Map(posts.map((post) => [post.id, post])).values());

    const postsWithScores = uniquePosts.map((post) => {
      const baseScore = post.relevance?.[0]?.relevanceScore ?? 0;
      const computedScore = calculateRelevanceScore(
        post,
        user,
        uniquePosts[0]?.id || undefined,
      );

      return {
        ...post,
        relevanceScore: computedScore * 0.8 + baseScore * 1.2 + Math.random() * 0.01,
      };
    });

    const sortedPosts = postsWithScores
      .sort((a, b) => {
        const diff = b.relevanceScore - a.relevanceScore;
        return diff !== 0
          ? diff
          : b.createdAt.getTime() - a.createdAt.getTime();
      })
      .slice(0, pageSize);

    const nextCursor = uniquePosts.length > pageSize + latestPosts.length
      ? uniquePosts[pageSize + latestPosts.length].id
      : null;

    const data: PostsPage = {
      posts: sortedPosts,
      nextCursor,
    };

    return Response.json(data);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}