import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getUserDataSelect } from "@/lib/types";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
    const pageSize = 10;

    const { user } = await validateRequest();

    if (!user) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    // Récupérer les suivis
    const following = await prisma.user.findMany({
      where: {
        AND: [
          { following: { some: { followingId: user.id } } },
          { NOT: { followers: { some: { followerId: user.id } } } },
        ],
      },
      take: pageSize + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: "asc" },
      select: getUserDataSelect(user.id),
    });

    const nextCursor =
      following.length > pageSize ? following[pageSize].id : null;
    const followingPage =
      following.length > pageSize ? following.slice(0, pageSize) : following;

    return Response.json({ users: followingPage, nextCursor });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
