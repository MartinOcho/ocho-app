import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import {
  getMessageDataInclude,
  MessageData,
  MessagesSection,
} from "@/lib/types";

export async function GET(
  req: Request,
  {
    params,
  }: {
    params: Promise<{ roomId: string }>;
  },
) {
  const {roomId} = await params
  try {
    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor") || undefined;
    const pageSize = 10;

    const { user } = await validateRequest();

    if (!user) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    // Vérifier si on récupère des messages sauvegardés ou une room
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

    let messages: MessageData[];

    if (isSavedMessages) {
      // Récupérer les messages sauvegardés
      messages = await prisma.message.findMany({
        where: {
          senderId: user.id,
          type: "SAVED",
        },
        include: getMessageDataInclude(user.id),
        orderBy: { createdAt: "desc" },
        take: pageSize + 1,
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : 0,
      });
      // Convertir les anciens messages SAVED en CONTENT pour l'affichage
      if (messages && messages.length > 0) {
        messages = messages.map((m) => {
          if (m.content !== `create-${user.id}`) {
            m.type = "CONTENT" as any;
          }
          return m;
        });
      }
    } else {
      // Récupérer les messages d'une room spécifique
      messages = await prisma.message.findMany({
        where: { roomId },
        include: getMessageDataInclude(user.id),
        orderBy: { createdAt: "desc" },
        take: pageSize + 1,
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : 0,
      });
    }

    const nextCursor =
      messages.length > pageSize ? messages[pageSize].id : null;

    const isGroup = roomData?.isGroup;

    if (isGroup) {
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
          { error: "Vous avez été suspendu de ce groupe par un administrateur" },
          { status: 403 },
        );
      }

      const leftDate = member.leftAt;
      if (leftDate) {
        // Filter out messages sent after the user left the group
        messages = messages.filter((message) => message.createdAt < leftDate);
      }
    }

    const data: MessagesSection = {
      messages: messages.slice(0, pageSize),
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
