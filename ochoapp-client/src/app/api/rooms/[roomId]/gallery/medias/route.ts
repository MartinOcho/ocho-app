import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { MessageAttachment } from "@/lib/types";

export interface GalleryMediasSection {
  medias: (MessageAttachment & { messageId: string; senderUsername: string; senderAvatar: string | null; sentAt: Date })[];
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

    const { user } = await validateRequest();

    if (!user) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    // Vérifier si on récupère les médias sauvegardés
    const isSavedMessages = roomId === `saved-${user.id}`;
    
    let roomData;
    if (!isSavedMessages) {
      roomData = await prisma.room.findUnique({
        where: { id: roomId },
      });
      if (!roomData) {
        return Response.json(
          { error: "Le canal n'existe pas" },
          { status: 400 },
        );
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
        return Response.json(
          { error: "Vous n'êtes pas membre de ce groupe" },
          { status: 403 },
        );
      }
      if (member.type === "BANNED") {
        return Response.json(
          { error: "Vous avez été suspendu de ce groupe" },
          { status: 403 },
        );
      }

      const leftDate = member.leftAt;
      if (leftDate) {
        // Filter out messages sent after the user left the group
        messagesWithAttachments = messagesWithAttachments.filter(
          (message) => message.createdAt < leftDate
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
            senderUsername: message.sender?.username,
            senderAvatar: message.sender?.avatarUrl,
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

    return Response.json(data);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Erreur interne du serveur" },
      { status: 500 },
    );
  }
}
