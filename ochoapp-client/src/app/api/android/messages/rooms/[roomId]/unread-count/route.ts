import { getCurrentUser } from "@/app/api/android/auth/utils";
import { ApiResponse } from "@/app/api/android/utils/dTypes";
import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import {
  getMessageDataInclude,
  getUserDataSelect,
  MessageData,
  MessagesSection,
  NotificationCountInfo,
} from "@/lib/types";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

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
    const url = new URL(req.url);

    const { user: loggedInUser, message } = await getCurrentUser();
    if (!loggedInUser) {
      return NextResponse.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      } as ApiResponse<null>);
    }

    const user = await prisma.user.findFirst({
      where: {
        id: loggedInUser.id,
      },
      select: getUserDataSelect(loggedInUser.id, loggedInUser.username),
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      } as ApiResponse<null>);
    }

    const userId = user.id;

    if (roomId === `saved-${user.id}`) {
      return NextResponse.json<ApiResponse<NotificationCountInfo>>({
        success: true,
        data: {
          unreadCount: 0,
        },
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

    return NextResponse.json<ApiResponse<NotificationCountInfo>>({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des messages :", error);
    return NextResponse.json({
      success: false,
      message: "Erreur interne du serveur",
      name: "server-error",
      data: null,
      error: error instanceof Error ? error.message : String(error),
    } as ApiResponse<null>);
  }
}
