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

    // Récupérer les posts suivants triés par pertinence
    const relevantPosts = await prisma.post.findMany({
      include: getPostDataIncludes(user.id),
      orderBy: [
        {
          relevanceScore: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      take: pageSize + 1,
      cursor: cursor ? { id: cursor } : undefined,
      where: {
        id: {
          notIn: latestPosts.map(post => post.id), // Exclure les posts déjà récupérés
        },
      },
    });

    const posts = [...latestPosts, ...relevantPosts];

    const postsWithScores = posts.slice(0, pageSize).map((post) => ({
      ...post,
      relevanceScore: calculateRelevanceScore(
        post,
        user,
        posts[0]?.id || undefined,
      ),
    }));

    const sortedPosts = postsWithScores
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    const nextCursor = posts.length > pageSize + latestPosts.length ? posts[pageSize + latestPosts.length].id : null;

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