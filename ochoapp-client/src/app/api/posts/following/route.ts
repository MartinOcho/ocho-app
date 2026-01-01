import { validateRequest } from "@/auth";
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

    // Récupérer les trois derniers posts triés par date
    const latestPosts = await prisma.post.findMany({
      include: getPostDataIncludes(user.id),
      orderBy: {
        createdAt: "desc",
      },
      take: !cursor ? 3 : 0,
      where: {
        user: {
          followers: {
            some: {
              followerId: user.id,
            },
          },
        },
      },
    });

    const pageSize = 5 + latestPosts.length;

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
          {
            id: {
              notIn: latestPosts.map((post) => post.id), // Exclure les posts déjà récupérés
            },
          },
        ],
      },
    });

    const allPosts = [...latestPosts, ...relevantPosts];
    const nextCursor =
      allPosts.length > pageSize + latestPosts.length ? allPosts[pageSize + latestPosts.length].id : null;

    const data: PostsPage = {
      posts: allPosts.slice(0, pageSize), // Limiter le nombre de posts retournés
      nextCursor,
    };

    return Response.json(data);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
