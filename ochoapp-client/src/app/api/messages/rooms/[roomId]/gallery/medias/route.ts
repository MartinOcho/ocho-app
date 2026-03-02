import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { MessageAttachment } from "@/lib/types";

export interface GalleryMediasSection {
  medias: (MessageAttachment & { messageId: string; senderUsername: string | null; senderAvatar: string | null; sentAt: Date })[];
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
            select: {
              id: true,
              roomId: true,
              content: true,
              senderId: true,
              recipientId: true,
              type: true,
              createdAt: true,
            },
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
            select: {
              id: true,
              roomId: true,
              content: true,
              senderId: true,
              recipientId: true,
              type: true,
              createdAt: true,
            },
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

    return Response.json(data);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Erreur interne du serveur" },
      { status: 500 },
    );
  }
}
