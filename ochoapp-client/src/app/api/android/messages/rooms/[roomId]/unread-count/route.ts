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

    // On s'assure que prisma est bien connecté
    const roomMember = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          userId,
          roomId,
        },
      },
    });

    if (!roomMember) return 0;

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
