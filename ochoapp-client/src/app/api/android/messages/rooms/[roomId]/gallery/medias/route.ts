import { getCurrentUser } from "@/app/api/android/auth/utils";
import { ApiResponse } from "@/app/api/android/utils/dTypes";
import prisma from "@/lib/prisma";
import { getUserDataSelect, MessageAttachment } from "@/lib/types";
import { NextResponse } from "next/server";

export interface GalleryMediasSection {
  medias: (MessageAttachment & {
    messageId: string;
    senderUsername: string | null;
    senderAvatar: string | null;
    sentAt: Date;
  })[];
  nextCursor: string | null;
}

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
    const cursor = url.searchParams.get("cursor") || undefined;
    const pageSize = 12;

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
    // Vérifier si on récupère les médias sauvegardés
    const isSavedMessages = roomId === `saved-${userId}`;

    let roomData;
    if (!isSavedMessages) {
      roomData = await prisma.room.findUnique({
        where: { id: roomId },
      });
      if (!roomData) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          message: "Room introuvable.",
          name: "room-not-found",
        });
      }
    }

    // Chercher les messages avec attachements
    let messagesWithAttachments;

    if (isSavedMessages) {
      // Récupérer les médias des messages sauvegardés
      messagesWithAttachments = await prisma.message.findMany({
        where: {
          senderId: user.id,
          type: "SAVED",
          attachments: {
            some: {}, // Au moins un attachement
          },
        },
        include: {
          attachments: {
            select: {
              id: true,
              type: true,
              url: true,
              publicId: true,
              width: true,
              height: true,
              format: true,
              resourceType: true,
            },
          },
          sender: {
            select: {
              username: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: pageSize + 1,
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : 0,
      });
    } else {
      // Récupérer les médias d'une room spécifique
      messagesWithAttachments = await prisma.message.findMany({
        where: {
          roomId,
          attachments: {
            some: {}, // Au moins un attachement
          },
        },
        include: {
          attachments: {
            select: {
              id: true,
              type: true,
              url: true,
              publicId: true,
              width: true,
              height: true,
              format: true,
              resourceType: true,
            },
          },
          sender: {
            select: {
              username: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: pageSize + 1,
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : 0,
      });
    }

    // Vérifier les permissions pour les groupes
    if (!isSavedMessages && roomData?.isGroup) {
      const member = await prisma.roomMember.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId: user.id,
          },
        },
      });
      if (!member) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          data: null,
          message: "Utilisateur non trouvé.",
          name: "not_found",
        });
      }
      if (member.type === "BANNED") {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          data: null,
          message: "Utilisateur banni.",
          name: "banned",
        });
      }

      const leftDate = member.leftAt;
      if (leftDate) {
        // Filter out messages sent after the user left the group
        messagesWithAttachments = messagesWithAttachments.filter(
          (message) => message.createdAt < leftDate,
        );
      }
    }

    // Transformer les données en format plat pour la galerie
    const medias: GalleryMediasSection["medias"] = [];
    const processedMessages: string[] = [];

    for (const message of messagesWithAttachments.slice(0, pageSize)) {
      if (message.attachments && message.attachments.length > 0) {
        for (const attachment of message.attachments) {
          medias.push({
            ...attachment,
            messageId: message.id,
            senderUsername: message.sender?.username || null,
            senderAvatar: message.sender?.avatarUrl || null,
            sentAt: message.createdAt,
          });
        }
        processedMessages.push(message.id);
      }
    }

    const nextCursor =
      messagesWithAttachments.length > pageSize
        ? messagesWithAttachments[pageSize].id
        : null;

    const data: GalleryMediasSection = {
      medias,
      nextCursor,
    };

    return NextResponse.json<ApiResponse<GalleryMediasSection>>({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      success: false,
      message: "Erreur interne du serveur",
      name: "server-error",
      data: null,
      error: error instanceof Error ? error.message : String(error),
    } as ApiResponse<null>);
  }
}
