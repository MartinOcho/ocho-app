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
    let messagesAttachments;

    if (isSavedMessages) {
      // Récupérer les médias des messages sauvegardés
      messagesAttachments = await prisma.messageAttachment.findMany({
        where: {
          message: {
            senderId: user.id,
            type: "SAVED",
          },
          messageId: {
            not: null,
          }
        },
        include: {
          message: {
            include: {
              sender: {
                select: {
                  id: true,
                  displayName: true,
                  username: true,
                  avatarUrl: true,
                },
              },
              recipient: {
                select: {
                  id: true,
                  displayName: true,
                  username: true,
                  avatarUrl: true,
                },
              },
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
      messagesAttachments = await prisma.messageAttachment.findMany({
        where: {
          message: {
            roomId,
          },
          messageId: {
            not: null,
          }
        },
        include: {
          message: {
            include: {
              sender: {
                select: {
                  id: true,
                  displayName: true,
                  username: true,
                  avatarUrl: true,
                },
              },
              recipient: {
                select: {
                  id: true,
                  displayName: true,
                  username: true,
                  avatarUrl: true,
                },
              },
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
        messagesAttachments = messagesAttachments.filter(
          (attachment) => attachment.message && attachment.message.createdAt < leftDate,
        );
      }
    }
    // Transformer les données en format plat pour la galerie
    const medias: GalleryMediasSection["medias"] = [];
    const processedAttachmentIds: string[] = [];
    for (const attachment of messagesAttachments) {
      if (!processedAttachmentIds.includes(attachment.id)) {
        if (attachment.message) {
          processedAttachmentIds.push(attachment.id);
          medias.push({
            ...attachment,
            messageId: attachment.message.id,
            senderUsername: attachment.message.sender?.username || null,
            senderAvatar: attachment.message.sender?.avatarUrl || null,
            sentAt: attachment.message.createdAt,
          });
        }
      }
    }

    const nextCursor =
      messagesAttachments.length > pageSize
        ? messagesAttachments[pageSize].id
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
