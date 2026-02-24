import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NotificationCountInfo } from "@/lib/types";

export async function GET(
  req: Request,
  {
    params,
  }: {
    params: Promise<{ roomId: string }>;
  },
) {
  const { roomId } = await params;

  try {
    const { user } = await validateRequest();

    if (!user) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    const userId = user.id;

    // On s'assure que prisma est bien connecté
    const roomMember = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          userId,
          roomId,
        },
      },
    });

    if (!roomMember) {
      return Response.json({
        error: "Vous n'êtes pas membre de cette discussion.",
      }, { status: 404 });
    }

    const joinedAt = roomMember.joinedAt;
    const leftAt = roomMember.leftAt;

    const dateFilter: any = {
      // Typage any temporaire pour flexibilité Prisma ou Prisma.DateTimeFilter
      gte: joinedAt,
    };

    if (leftAt) {
      dateFilter.lte = leftAt;
    }

    const unreadCount = await prisma.message.count({
      where: {
        roomId: roomId,
        createdAt: dateFilter,
        senderId: { not: userId },
        reads: {
          none: {
            userId: userId,
          },
        },
        OR: [
          { type: { not: "REACTION" } },
          {
            AND: [
              { type: "REACTION" },
              { OR: [{ recipientId: userId }, { senderId: userId }] },
            ],
          },
        ],
        NOT: {
          AND: {
            type: "CREATE",
            senderId: userId,
          },
        },
      },
    });

    const data: NotificationCountInfo = {
      unreadCount,
    };

    return Response.json(data);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
