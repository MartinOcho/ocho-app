import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NotificationCountInfo } from "@/lib/types";
import { Prisma } from "@prisma/client";

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

    if (roomId === `saved-${user.id}`) {
      return Response.json({
        unreadCount: 0,
      });
    }

    const roomMember = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          userId: user.id,
          roomId,
        },
      },
    });

    if (!roomMember) {
      return Response.json({
        unreadCount: 0,
      });
    }

    const joinedAt = roomMember.joinedAt;
    
    const dateFilter: Prisma.DateTimeFilter = {
      gte: joinedAt,
    };

    if (roomMember.leftAt) {
      dateFilter.lte = roomMember.leftAt;
    }
    
    const whereClause: Prisma.MessageWhereInput = {
      roomId: roomId,
      createdAt: dateFilter, 
      senderId: { not: user.id },
      reads: {
        none: {
          userId: user.id,
        },
      },
      OR: [
        {
          type: {
            not: "REACTION",
          },
        },
        {
          AND: [
            {
              type: "REACTION",
            },
            {
              OR: [{ recipientId: user.id }, { senderId: user.id }],
            },
          ],
        },
      ],
      NOT: {
        AND: {
          type: "CREATE",
          senderId: user.id,
        },
      },
    };

    const unreadCount = await prisma.message.count({
      where: whereClause,
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