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

export async function getRoom(req: Request, res: Response) {
  const roomId = req.params.roomId;
  try {
    const { user: loggedInUser, message } = await getCurrentUser(req.headers);
    if (!loggedInUser) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: loggedInUser.id },
      select: getUserDataSelect(loggedInUser.id, loggedInUser.username),
    });

    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    if (roomId === `saved-${user.id}`) {
      const savedMessages = await prisma.message.findMany({
        where: { senderId: user.id, type: "SAVED" },
        include: getMessageDataInclude(user.id),
        take: 1,
        orderBy: { createdAt: "desc" },
      });

      const existingSavedMsg = savedMessages[0];
      if (existingSavedMsg) {
        const createInfo = await prisma.message.findFirst({
          where: { senderId: user.id, type: "SAVED" },
          include: getMessageDataInclude(user.id),
          take: 1,
          orderBy: { createdAt: "asc" },
        });

        const displayedMsg = { ...existingSavedMsg };
        if (displayedMsg.content !== `create-${user.id}`) {
          displayedMsg.type = "CONTENT" as any;
        }

        const roomData: RoomData = {
          id: `saved-${user.id}`,
          name: null,
          description: null,
          groupAvatarUrl: null,
          privilege: "MANAGE",
          members: [
            {
              user,
              userId: user.id,
              type: "OWNER",
              joinedAt: user.createdAt,
              leftAt: null,
              kickedAt: null,
            },
          ],
          maxMembers: 300,
          messages: [displayedMsg],
          isGroup: false,
          createdAt: createInfo?.createdAt || new Date(),
        };

        return res.json({ success: true, data: roomData });
      }

      const createInfo = await prisma.message.create({
        data: { content: `create-${user.id}`, senderId: user.id, type: "SAVED" },
        include: getMessageDataInclude(user.id),
      });

      const roomData: RoomData = {
        id: `saved-${user.id}`,
        name: null,
        description: null,
        groupAvatarUrl: null,
        privilege: "MANAGE",
        members: [
          {
            user,
            userId: user.id,
            type: "OWNER",
            joinedAt: user.createdAt,
            leftAt: null,
            kickedAt: null,
          },
        ],
        maxMembers: 300,
        messages: [createInfo],
        isGroup: false,
        createdAt: createInfo.createdAt,
      };

      return res.json({ success: true, data: roomData });
    }

    const roomData = await prisma.room.findUnique({ where: { id: roomId } });
    if (!roomData) {
      return res.status(404).json({ success: false, message: "Canal non trouvé.", name: "not_found" });
    }

    const membersData = await prisma.roomMember.findMany({ where: { roomId } });
    const members = await Promise.all(
      membersData.map(async (member) => {
        if (!member.userId) return null;
        const memberUser = await prisma.user.findUnique({
          where: { id: member.userId },
          select: getUserDataSelect(user.id),
        });
        return memberUser
          ? {
              user: memberUser,
              userId: member.userId,
              type: member.type,
              joinedAt: member.joinedAt,
              leftAt: member.leftAt,
              kickedAt: member.kickedAt,
            }
          : null;
      }),
    );

    return res.json({
      success: true,
      data: {
        ...roomData,
        members: members.filter((m): m is NonNullable<typeof m> => m !== null),
        messages: [],
      },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des données du canal :", error);
    return res.status(500).json({ success: false, message: "Erreur interne du serveur", name: "server-error" });
  }
}

export async function getMessages(req: Request, res: Response) {
  const roomId = req.params.roomId;
  const cursor = (req.query.cursor as string) || undefined;
  const pageSize = 10;

  try {
    const { user: loggedInUser, message } = await getCurrentUser(req.headers);
    if (!loggedInUser) {
      return res.json({ success: false, message: message || "Utilisateur non authentifié.", name: "unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: loggedInUser.id },
      select: getUserDataSelect(loggedInUser.id, loggedInUser.username),
    });
    if (!user) {
      return res.json({ success: false, message: message || "Utilisateur non authentifié.", name: "unauthorized" });
    }

    let messages: MessageData[] = [];

    if (roomId === `saved-${user.id}`) {
      messages = await prisma.message.findMany({
        where: { senderId: user.id, type: "SAVED" },
        include: getMessageDataInclude(user.id),
        orderBy: { createdAt: "desc" },
        take: pageSize + 1,
        cursor: cursor ? { id: cursor } : undefined,
      });
      messages = messages.map((msg) => {
        if (msg.content !== `create-${user.id}`) {
          msg.type = "CONTENT" as any;
        }
        return msg;
      });
    } else {
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room) {
        return res.status(404).json({ success: false, message: "Canal non trouvé.", name: "not_found" });
      }

      messages = await prisma.message.findMany({
        where: { roomId },
        include: getMessageDataInclude(user.id),
        orderBy: { createdAt: "desc" },
        take: pageSize + 1,
        cursor: cursor ? { id: cursor } : undefined,
      });

      if (room.isGroup) {
        const member = await prisma.roomMember.findUnique({
          where: { roomId_userId: { roomId, userId: user.id } },
        });
        if (!member) {
          return res.status(404).json({ success: false, message: "Utilisateur non trouvé.", name: "not_found" });
        }
        if (member.type === "BANNED") {
          return res.status(403).json({ success: false, message: "Utilisateur banni.", name: "banned" });
        }

        if (member.leftAt) {
          messages = messages.filter((msg) => msg.createdAt < member.leftAt!);
        }
      }
    }

    const nextCursor = messages.length > pageSize ? messages[pageSize].id : null;
    return res.json({ success: true, data: { messages: messages.slice(0, pageSize), nextCursor } });
  } catch (error) {
    console.error("Erreur lors de la récupération des messages :", error);
    return res.status(500).json({ success: false, message: "Erreur interne du serveur", name: "server-error" });
  }
}

export async function getRoomMedias(req: Request, res: Response) {
  const roomId = req.params.roomId;
  const cursor = (req.query.cursor as string) || undefined;
  const pageSize = 12;

  try {
    const { user: loggedInUser, message } = await getCurrentUser(req.headers);
    if (!loggedInUser) {
      return res.json({ success: false, message: message || "Utilisateur non authentifié.", name: "unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: loggedInUser.id },
      select: getUserDataSelect(loggedInUser.id, loggedInUser.username),
    });
    if (!user) {
      return res.json({ success: false, message: message || "Utilisateur non authentifié.", name: "unauthorized" });
    }

    const isSavedMessages = roomId === `saved-${user.id}`;

    const roomData = isSavedMessages
      ? null
      : await prisma.room.findUnique({ where: { id: roomId } });

    if (!isSavedMessages && !roomData) {
      return res.status(404).json({ success: false, message: "Room introuvable.", name: "room-not-found" });
    }

    let attachments = await prisma.messageAttachment.findMany({
      where: {
        message: {
          ...(isSavedMessages
            ? { senderId: user.id, type: "SAVED" }
            : { roomId }),
        },
        messageId: { not: null },
      },
      include: {
        message: {
          include: {
            sender: { select: { id: true, displayName: true, username: true, avatarUrl: true } },
            recipient: { select: { id: true, displayName: true, username: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
    });

    if (!isSavedMessages && roomData?.isGroup) {
      const member = await prisma.roomMember.findUnique({
        where: { roomId_userId: { roomId, userId: user.id } },
      });
      if (!member) {
        return res.status(404).json({ success: false, data: null, message: "Utilisateur non trouvé.", name: "not_found" });
      }
      if (member.type === "BANNED") {
        return res.status(403).json({ success: false, data: null, message: "Utilisateur banni.", name: "banned" });
      }

      if (member.leftAt) {
        attachments = attachments.filter((attachment) => attachment.message && attachment.message.createdAt < member.leftAt!);
      }
    }

    const medias = attachments
      .filter((attachment) => attachment.message)
      .map((attachment) => ({
        ...attachment,
        messageId: attachment.message!.id,
        senderUsername: attachment.message!.sender?.username || null,
        senderAvatar: attachment.message!.sender?.avatarUrl || null,
        sentAt: attachment.message!.createdAt,
      }));

    const nextCursor = attachments.length > pageSize ? attachments[pageSize].id : null;

    return res.json({ success: true, data: { medias, nextCursor } });
  } catch (error) {
    console.error("Erreur lors de la récupération des medias du canal :", error);
    return res.status(500).json({ success: false, message: "Erreur interne du serveur", name: "server-error" });
  }
}

export async function getUnreadMessagesCount(req: Request, res: Response) {
  const roomId = req.params.roomId;

  try {
    const { user: loggedInUser, message } = await getCurrentUser(req.headers);
    if (!loggedInUser) {
      return res.json({ success: false, message: message || "Utilisateur non authentifié.", name: "unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: loggedInUser.id },
      select: getUserDataSelect(loggedInUser.id, loggedInUser.username),
    });
    if (!user) {
      return res.json({ success: false, message: message || "Utilisateur non authentifié.", name: "unauthorized" });
    }

    if (roomId === `saved-${user.id}`) {
      return res.json({ success: true, data: { unreadCount: 0 } });
    }

    const roomMember = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: user.id } },
    });

    if (!roomMember) {
      return res.json({ success: true, data: { unreadCount: 0 } });
    }

    const dateFilter: any = { gte: roomMember.joinedAt };
    if (roomMember.leftAt) {
      dateFilter.lte = roomMember.leftAt;
    }

    const unreadCount = await prisma.message.count({
      where: {
        roomId,
        createdAt: dateFilter,
        senderId: { not: user.id },
        reads: { none: { userId: user.id } },
        OR: [
          { type: { not: "REACTION" } },
          {
            AND: [
              { type: "REACTION" },
              { OR: [{ recipientId: user.id }, { senderId: user.id }] },
            ],
          },
        ],
        NOT: { AND: [{ type: "CREATE" }, { senderId: user.id }] },
      },
    });

    return res.json({ success: true, data: { unreadCount } });
  } catch (error) {
    console.error("Erreur lors de la récupération du compteur de messages non lus :", error);
    return res.status(500).json({ success: false, message: "Erreur interne du serveur", name: "server-error" });
  }
}

export async function getMessageUsersByFilter(req: Request, res: Response) {
  const filter = req.params.filter;
  const searchQuery = (req.query.q as string) || undefined;
  const cursor = (req.query.cursor as string) || undefined;
  const pageSize = 10;

  try {
    const { user: loggedInUser, message } = await getCurrentUser(req.headers);
    if (!loggedInUser) {
      return res.json({ success: false, message: message || "Utilisateur non authentifié.", name: "unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: loggedInUser.id },
      select: getUserDataSelect(loggedInUser.id, loggedInUser.username),
    });

    if (!user) {
      return res.json({ success: false, message: message || "Utilisateur introuvable.", name: "unauthorized" });
    }

    let whereClause: any = {};
    const searchCondition = searchQuery
      ? {
          OR: [
            { displayName: { contains: searchQuery, mode: "insensitive" } },
            { username: { contains: searchQuery, mode: "insensitive" } },
          ],
        }
      : undefined;

    switch (filter) {
      case "friends":
        whereClause = {
          AND: [
            { followers: { some: { followerId: user.id } } },
            { following: { some: { followingId: user.id } } },
            ...(searchCondition ? [searchCondition] : []),
          ],
        };
        break;
      case "followers":
        whereClause = {
          AND: [
            { followers: { some: { followerId: user.id } } },
            { NOT: { following: { some: { followingId: user.id } } } },
            ...(searchCondition ? [searchCondition] : []),
          ],
        };
        break;
      case "following":
        whereClause = {
          AND: [
            { following: { some: { followingId: user.id } } },
            { NOT: { followers: { some: { followerId: user.id } } } },
            ...(searchCondition ? [searchCondition] : []),
          ],
        };
        break;
      default:
        whereClause = {
          AND: [
            { followers: { none: { followerId: user.id } } },
            { following: { none: { followingId: user.id } } },
            { id: { not: user.id } },
            ...(searchCondition ? [searchCondition] : []),
          ],
        };
        break;
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      take: pageSize + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: "asc" },
      select: getUserDataSelect(user.id),
    });

    const nextCursor = users.length > pageSize ? users[pageSize].id : null;
    const usersPage = users.length > pageSize ? users.slice(0, pageSize) : users;

    return res.json({ success: true, data: { users: usersPage, nextCursor } });
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs :", error);
    return res.status(500).json({ success: false, message: "Erreur interne du serveur", name: "server-error" });
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