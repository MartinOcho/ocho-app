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

    const pageSize = 10;

    // Requête unique et optimisée pour la pagination
    const posts = await prisma.post.findMany({
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
      skip: cursor ? 1 : 0, // Skip the cursor for the next page
    });

    const hasMore = posts.length > pageSize;
    const postsToReturn = hasMore ? posts.slice(0, pageSize) : posts;
    const nextCursor = hasMore ? postsToReturn[pageSize - 1].id : null;

    const data: PostsPage = {
      posts: postsToReturn,
      nextCursor,
    };

    return Response.json(data);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}