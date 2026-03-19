import { Request, Response } from "express";
import prisma from "./prisma";
import { getCurrentUser } from "./auth";
import { getChatRoomDataInclude, getMessageDataInclude, getUserDataSelect, MessageData, RoomData } from "./types";
import { get } from "node:http";

export async function getMessageRooms(req: Request, res: Response) {
  try {
    const cursor = req.query.cursor as string | undefined;
    const pageSize = 10;
    const { user: loggedInUser, message } = await getCurrentUser(req.headers);
    if (!loggedInUser) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const userId = loggedInUser.id;
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
      },
      select: getUserDataSelect(loggedInUser.id, loggedInUser.username),
    });

    if (!user) {
      return res.json({
        success: false,
        message: "User not found.",
      });
    }


    // Retrieve last messages to get rooms
     const lastMessages = await prisma.lastMessage.findMany({
      where: { userId },
      select: {
        roomId: true,
        messageId: true,
        message: { include: getMessageDataInclude(userId) },
        room: { include: getChatRoomDataInclude() },
      },
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
      cursor: cursor
        ? { userId_roomId: { userId, roomId: cursor } }
        : undefined,
    });

    const rooms: RoomData[] = lastMessages
      .map((lm) => {
        const lastMsg = lm.message as MessageData | null;
        const roomData = lm.room;
        if (!roomData) return null;
        return {
          ...roomData,
          messages: lastMsg ? [lastMsg] : [],
          members: roomData.members || [],
        } as RoomData;
      })
      .filter((r): r is RoomData => r !== null);

    // 3. Injection de la "Self Room" (Messages Enregistrés)
    if (!cursor) {
      const savedMessage = await prisma.message.findFirst({
        where: { senderId: userId, type: "SAVED" },
        include: getMessageDataInclude(userId),
        orderBy: { createdAt: "desc" },
      });

      if (savedMessage) {
        // Logique visuelle : si le contenu est technique "create-userId", on le garde en SAVED (caché/système)
        let type = "CONTENT";
        if (savedMessage.content === "create-" + userId) {
          type = "SAVED";
        }

        const selfMessage = { ...savedMessage, type };

        // Création de la room virtuelle en mémoire
        const selfRoom: RoomData = {
          id: `saved-${userId}`, // ID Virtuel
          name: "Messages enregistrés",
          description: null,
          groupAvatarUrl: null,
          privilege: "MANAGE",
          isGroup: false,
          createdAt: savedMessage.createdAt,
          maxMembers: 1,
          members: [
            {
              user,
              userId,
              type: "OWNER",
              joinedAt: user.createdAt,
              leftAt: null,
              kickedAt: null,
            },
          ],
          messages: [selfMessage as MessageData],
        };

        // On l'ajoute au tout début de la liste
        rooms.unshift(selfRoom);
        // Note : Cette room n'existe pas en base, elle est purement virtuelle pour l'UI. Pas de création en DB nécessaire.
      }
    }

    return res.json({
      success: true,
      message: "Rooms retrieved successfully.",
      data: rooms,
    });
  } catch (error) {
    console.error(error);
    return res.json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
}

export async function searchMessageUsers(req: Request, res: Response) {
  try {
    const cursor = req.query.cursor as string | undefined;
    const searchQuery = req.query.q as string | undefined;
    const pageSize = 10;

    const { user: loggedInUser, message } = await getCurrentUser(req.headers);
    if (!loggedInUser) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        id: loggedInUser.id,
      },
      select: getUserDataSelect(loggedInUser.id, loggedInUser.username),
    });

    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const userId = user.id;

    if (searchQuery) {
      const sanitizedQuery = searchQuery.replace(/[%_]/g, "\\$&");
      const users = await prisma.user.findMany({
        where: {
          OR: [
            {
              displayName: {
                contains: sanitizedQuery,
                mode: "insensitive",
              },
            },
            {
              username: {
                contains: sanitizedQuery,
                mode: "insensitive",
              },
            },
          ],
        },
        take: pageSize + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { id: "asc" },
        select: getUserDataSelect(user.id),
      });

      const nextCursor = users.length > pageSize ? users[pageSize].id : null;
      const usersPage =
        users.length > pageSize ? users.slice(0, pageSize) : users;

      return res.json({
        success: true,
        data: { users: usersPage, nextCursor },
      });
    }

    return res.json({
      success: false,
      message: "Search query is required",
    });
  } catch (error) {
    console.error(error);
    return res.json({
      success: false,
      message: "Erreur interne du serveur",
      name: "server-error",
    });
  }
}

export async function getMessageDeliveries(req: Request, res: Response) {
  const { messageId } = req.params;
  const { user: loggedInUser, message } = await getCurrentUser(req.headers);
  if (!loggedInUser) {
    return res.json({
      success: false,
      message: message || "Utilisateur non authentifié.",
      name: "unauthorized",
    });
  }

  try {
    const messageData = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        deliveries: {
          select: {
            user: {
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
    });

    if (!messageData) {
      return res.json({
        success: false,
        message: "Message non trouvé.",
        name: "not-found",
      });
    }

    const deliveries = messageData.deliveries.map((delivery) => delivery.user);

    const data = {
      deliveries,
    };
    return res.json({ success: true, data });
  } catch (error) {
    console.error(error);
    return res.json({
      success: false,
      message: "Erreur interne du serveur",
      name: "server-error",
    });
  }
}

export async function getMessageReactions(req: Request, res: Response) {
  const { messageId } = req.params;
  try {
    const { user: loggedInUser, message: msg } = await getCurrentUser(
      req.headers
    );
    if (!loggedInUser) {
      return res.json({
        success: false,
        message: msg || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const messageData = await prisma.message.findUnique({
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

    if (!messageData) {
      return res.json({
        success: false,
        message: "Message non trouvé",
        name: "not-found",
      });
    }

    const reactions = messageData.reactions;

    const groupedMap = new Map<
      string,
      {
        content: string;
        count: number;
        hasReacted: boolean;
        users: Array<{
          id: string;
          displayName: string;
          username: string;
          avatarUrl: string | null;
          reactedAt: Date;
        }>;
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

    return res.json({
      success: true,
      data: groupedReactions,
    });
  } catch (error) {
    console.error(error);
    return res.json({
      success: false,
      message: "Erreur interne du serveur",
      name: "server-error",
    });
  }
}

export async function getMessageReads(req: Request, res: Response) {
  const { messageId } = req.params;
  const { user: loggedInUser, message } = await getCurrentUser(req.headers);
  if (!loggedInUser) {
    return res.json({
      success: false,
      message: message || "Utilisateur non authentifié.",
      name: "unauthorized",
    });
  }

  try {
    const messageData = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        reads: {
          select: {
            user: {
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
    });

    if (!messageData) {
      return res.json({
        success: false,
        message: "Message non trouvé.",
        name: "not-found",
      });
    }

    const reads = messageData.reads.map((read) => read.user);

    const data = {
      reads,
    };
    return res.json({ success: true, data });
  } catch (error) {
    console.error(error);
    return res.json({
      success: false,
      message: "Erreur interne du serveur",
      name: "server-error",
    });
  }
}