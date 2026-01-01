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

    // Récupérer les followers
    const followers = await prisma.user.findMany({
      where: {
        AND: [
          { followers: { some: { followerId: user.id } } },
          { NOT: { following: { some: { followingId: user.id } } } },
        ],
      },
      take: pageSize + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: "asc" },
      select: getUserDataSelect(user.id),
    });

    const nextCursor =
      followers.length > pageSize ? followers[pageSize].id : null;
    const followersPage =
      followers.length > pageSize ? followers.slice(0, pageSize) : followers;

    return Response.json({ users: followersPage, nextCursor });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
