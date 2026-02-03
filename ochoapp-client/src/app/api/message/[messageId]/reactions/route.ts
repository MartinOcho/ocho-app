import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { GroupedUser, ReactionData } from "@/lib/types";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const { messageId } = await params;
  try {
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        reactions: {
          select: {
            user: {
              select: {
                id: true,
                displayName: true,
                username: true,
                avatarUrl: true,
              },
            },
            content: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!message) {
      return Response.json({ error: "Message non trouvé" }, { status: 404 });
    }

    const reactions: ReactionData[] = message.reactions;

    const groupedMap = new Map<
      string,
      {
        content: string;
        count: number;
        hasReacted: boolean;
        users: GroupedUser[];
      }
    >();

    reactions.forEach((r) => {
      if (!groupedMap.has(r.content)) {
        groupedMap.set(r.content, {
          content: r.content,
          count: 0,
          hasReacted: false,
          users: [],
        });
      }

      const entry = groupedMap.get(r.content)!;
      entry.count++;

      entry.users.push({
        ...r.user,
        reactedAt: r.createdAt,
      });

      if (r.user.id === loggedInUser.id) {
        entry.hasReacted = true;
      }
    });

    const groupedReactions = Array.from(groupedMap.values());

    return Response.json(groupedReactions);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
