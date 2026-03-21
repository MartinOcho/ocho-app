import { Request, Response } from "express";
import prisma from "./prisma";
import { getCurrentUser } from "./auth";
import {
  ApiResponse,
  getChatRoomDataInclude,
  getMessageDataInclude,
  getUserDataSelect,
  MessageData,
  MessagesSection,
  RoomData,
} from "./types";
import { get } from "node:http";
import { validateUser } from "./users";
import { Prisma } from "@prisma/client";

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
    const { userData, user } = await validateUser(req, res);
    if (!user || !userData) {
      return res.json({
        success: false,
        message: "Utilisateur non authentifié.",
        name: "unauthorized",
      } as ApiResponse<null>);
    }
    const userId = user.id;

    // Vérifier si on récupère des messages d'un canal ou des messages sauvegardés
    if (roomId === `saved-${user.id}`) {
      const existingSavedMsgs = await prisma.message.findMany({
        where: {
          senderId: {
            equals: userId,
          },
          type: {
            equals: "SAVED",
          },
        },
        include: getMessageDataInclude(user.id),
        take: 1,
        orderBy: { createdAt: "desc" },
      });
      if (existingSavedMsgs[0]) {
        const existingSavedMsg: MessageData = existingSavedMsgs[0];
        const createInfo = await prisma.message.findFirst({
          where: {
            senderId: {
              equals: userId,
            },
            type: {
              equals: "SAVED",
            },
          },
          include: getMessageDataInclude(user.id),
          take: 1,
          orderBy: { createdAt: "asc" },
        });

        // Convertir le message SAVED en CONTENT pour affichage si ce n'est pas
        // le marqueur technique create-<userId>
        const displayedMsg: MessageData = { ...existingSavedMsg };
        if (displayedMsg.content !== `create-${userId}`) {
          displayedMsg.type = "CONTENT" as any;
        }

        const newRoom: RoomData = {
          id: `saved-${userId}`,
          name: null,
          description: null,
          groupAvatarUrl: null,
          privilege: "MANAGE",
          members: [
            {
              user: userData,
              userId,
              type: "OWNER",
              joinedAt: userData.createdAt,
              leftAt: null,
              kickedAt: null,
            },
          ],
          maxMembers: 300,
          messages: [displayedMsg],
          isGroup: false,
          createdAt: createInfo?.createdAt || new Date(),
        };
        return res.json({
          success: true,
          data: newRoom,
        } as ApiResponse<RoomData>);
      }

      const createInfo: MessageData = await prisma.message.create({
        data: {
          content: `create-${user.id}`,
          senderId: userId,
          type: "SAVED",
        },
        include: getMessageDataInclude(user.id),
      });
      const existingSavedMsg: MessageData = existingSavedMsgs[0];
      const displayedMsgAfterCreate: MessageData = { ...existingSavedMsg };
      if (displayedMsgAfterCreate.content !== `create-${userId}`) {
        displayedMsgAfterCreate.type = "CONTENT" as any;
      }

      const newRoom: RoomData = {
        id: `saved-${userId}`,
        name: null,
        description: null,
        groupAvatarUrl: null,
        privilege: "MANAGE",
        members: [
          {
            user: userData,
            userId,
            type: "OWNER",
            joinedAt: userData.createdAt,
            leftAt: null,
            kickedAt: null,
          },
        ],
        maxMembers: 300,
        messages: [displayedMsgAfterCreate],
        isGroup: false,
        createdAt: createInfo?.createdAt || new Date(),
      };
      return res.json({
        success: true,
        data: newRoom,
      } as ApiResponse<RoomData>);
    } else {
      const roomData = await prisma.room.findFirst({
        where: {
          id: roomId,
        },
      });

      if (!roomData) {
        return res.json({
          success: false,
          data: null,
          message: "Canal non trouvé.",
          name: "not_found",
        });
      }
      // Récupérer les membres d'un canal spécifique
      const membersData = await prisma.roomMember.findMany({
        where: {
          roomId,
        },
      });
      const membersToFilter = await Promise.all(
        membersData.map(async (member) => {
          if (!member.userId || !member) {
            return null; // retournez null si aucune userId
          }

          const user = await prisma.user.findUnique({
            where: {
              id: member.userId,
            },
            select: getUserDataSelect(userId),
          });

          return {
            user,
            userId: member.userId,
            type: member.type,
            joinedAt: member.joinedAt,
            leftAt: member.leftAt,
            kickedAt: member.kickedAt,
          };
        }),
      );
      const messages: MessageData[] = [];
      const members = membersToFilter.filter((member) => member !== null);
      const room: RoomData = {
        ...roomData,
        members,
        messages,
      };
      return res.json({
        success: true,
        data: room,
      } as ApiResponse<RoomData>);
    }
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des données du canal :",
      error,
    );
    return res.json({
      success: false,
      message: "Erreur interne du serveur",
      name: "server-error",
      data: null,
      error: error instanceof Error ? error.message : String(error),
    } as ApiResponse<null>);
  }
}

export function formatSavedMessages(
  message: MessageData,
  userId: string,
): MessageData {
  if (message.content !== `create-${userId}`) {
    return { ...message, type: "CONTENT" };
  }
  return { ...message };
}

export async function getMessages(req: Request, res: Response) {
  const roomId = req.params.roomId;
  const cursor = (req.query.cursor as string) || undefined;
  const pageSize = 10;

  try {
    const { user: loggedInUser, message } = await getCurrentUser(req.headers);
    if (!loggedInUser) {
      return res.json({
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
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      } as ApiResponse<null>);
    }
    const userId = user.id;

    let messages: MessageData[];
    const member = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId: user.id,
        },
      },
    });
    if (!member) {
      return res.json({
        success: false,
        message: "Utilisateur non trouvé.",
        name: "not_found",
      } as ApiResponse<null>);
    }
    if (member.type === "BANNED") {
      return res.json({
        success: false,
        data: null,
        message: "Utilisateur banni.",
        name: "banned",
      } as ApiResponse<null>);
    }

    // Vérifier si on récupère des messages d'un canal ou des messages sauvegardés
    if (roomId === `saved-${user.id}`) {
      // Récupérer les messages sauvegardés (envoyés à soi-même)
      messages = await prisma.message.findMany({
        where: {
          senderId: userId,
          type: "SAVED",
        },
        include: getMessageDataInclude(user.id),
        orderBy: { createdAt: "desc" },
        take: pageSize + 1,
        cursor: cursor ? { id: cursor } : undefined,
      });
      if (messages[0]) {
        // modifier les types des messages qui n'ont pas "created" comme contenu et qui ne sont pas en premier message en "CONTENT"
        messages = messages.map((message) => {
          if (message.content !== `create-${user.id}`) {
            message.type = "CONTENT";
          }
          return message;
        });
      }
    } else {
      // Récupérer les messages d'un canal spécifique
      const room = await prisma.room.findFirst({
        where: {
          id: roomId,
        },
      });
      if (!room) {
        return res.json({
          success: false,
          message: "Canal non trouvé.",
          name: "not_found",
        } as ApiResponse<null>);
      }

      messages = await prisma.message.findMany({
        where: { roomId, createdAt: { lt: member?.leftAt || undefined } },
        include: getMessageDataInclude(user.id),
        orderBy: { createdAt: "desc" },
        take: pageSize + 1,
        cursor: cursor ? { id: cursor } : undefined,
      });
    }

    const nextCursor =
      messages.length > pageSize ? messages[pageSize].id : null;
    const roomData = await prisma.room.findUnique({
      where: { id: roomId },
    });

    const isGroup = roomData?.isGroup;

    if (isGroup) {
    }
    messages = messages.map((message) => {
      const formattedMsg: MessageData = {
        ...message,
      };
      return formattedMsg;
    });

    const data: MessagesSection = {
      messages: messages.slice(0, pageSize),
      nextCursor,
    };

    return res.json({
      success: true,
      data,
    } as ApiResponse<MessagesSection>);
  } catch (error) {
    console.error("Erreur lors de la récupération des messages :", error);
    return res.json({
      success: false,
      message: "Erreur interne du serveur",
      name: "server-error",
      data: null,
      error: error instanceof Error ? error.message : String(error),
    } as ApiResponse<null>);
  }
}

export async function getLastMessage(req: Request, res: Response) {
  const roomId = req.params.roomId;
  try {
    const { userData, user } = await validateUser(req, res);

    if (!user || !userData) {
      return res.json({
        success: false,
        message: "Utilisateur non authentifié.",
        name: "unauthorized",
      } as ApiResponse<null>);
    }
    const userId = user.id;

    const isSaved = roomId === `saved-${userId}`;

    if (isSaved) {
      const lastSavedMessage = await prisma.message.findFirst({
        where: { senderId: userId, type: "SAVED" },
        orderBy: { createdAt: "desc" },
        include: getMessageDataInclude(userId),
      });
      if (!lastSavedMessage) {
        return res.json({
          success: false,
          message: "Aucun message enregistré trouvé.",
          name: "not_found",
        } as ApiResponse<null>);
      }
      const displayedMsg: MessageData = formatSavedMessages(
        lastSavedMessage,
        userId,
      );
      return res.json({
        success: true,
        data: displayedMsg,
      } as ApiResponse<MessageData>);
    }

    const roomData = await prisma.room.findUnique({
      where: { id: roomId },
    });

    const member = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId: user.id,
        },
      },
    });
    if (!member) {
      return res.json({
        success: false,
        message: "Utilisateur non trouvé.",
        name: "not_found",
      } as ApiResponse<null>);
    }
    if (member.type === "BANNED") {
      return res.json({
        success: false,
        data: null,
        message: "Utilisateur banni.",
        name: "banned",
      } as ApiResponse<null>);
    }

    const leftDate = member.leftAt;

    const lastMessage = await prisma.message.findFirst({
      where: {
        roomId,
        createdAt: { lt: leftDate || undefined },
      },
      orderBy: { createdAt: "desc" },
      include: getMessageDataInclude(userId),
    });
    if (!lastMessage) {
      return res.json({
        success: false,
        message: "Aucun message trouvé.",
        name: "not_found",
      } as ApiResponse<null>);
    }
    const formattedMsg: MessageData = {
      ...lastMessage,
    };

    await prisma.lastMessage.upsert({
      where: {
        userId_roomId: {
          userId,
          roomId,
        },
      },
      create: {
        userId,
        roomId,
        messageId: lastMessage.id,
        createdAt: lastMessage.createdAt,
      },
      update: {
        messageId: lastMessage.id,
        createdAt: lastMessage.createdAt,
      },
    });
    return res.json({
      success: true,
      data: formattedMsg,
    } as ApiResponse<MessageData>);
  } catch (error) {
    console.error("Erreur lors de la récupération du dernier message :", error);
    return res.json({
      success: false,
      message: "Erreur interne du serveur",
      name: "server-error",
      data: null,
      error: error instanceof Error ? error.message : String(error),
    } as ApiResponse<null>);
  }
}

export async function getRoomMedias(req: Request, res: Response) {
  const roomId = req.params.roomId;
  const cursor = (req.query.cursor as string) || undefined;
  const pageSize = 12;

  try {
    const { userData, user } = await validateUser(req, res);
    if (!user || !userData) {
      return res.json({
        success: false,
        message: "Utilisateur non authentifié.",
        name: "unauthorized",
      } as ApiResponse<null>);
    }
    const userId = user.id;

    const isSavedMessages = roomId === `saved-${userId}`;

    const roomData = isSavedMessages
      ? null
      : await prisma.room.findUnique({ where: { id: roomId } });

    if (!isSavedMessages && !roomData) {
      return res.json({
        success: false,
        message: "Room introuvable.",
        name: "room-not-found",
      });
    }
    const member = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: user.id } },
    });
    if (!member) {
      return res.json({
        success: false,
        data: null,
        message: "Utilisateur non trouvé.",
        name: "not_found",
      });
    }
    if (member.type === "BANNED") {
      return res.json({
        success: false,
        data: null,
        message: "Utilisateur banni.",
        name: "banned",
      });
    }

    const attachments = await prisma.messageAttachment.findMany({
      where: {
        message: {
          ...(isSavedMessages
            ? { senderId: userId, type: "SAVED" }
            : { roomId }),
        },
        messageId: { not: null },
        createdAt: { lt: member?.leftAt || undefined },
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

    const medias = attachments
      .filter((attachment) => attachment.message)
      .map((attachment) => ({
        ...attachment,
        messageId: attachment.message!.id,
        senderUsername: attachment.message!.sender?.username || null,
        senderAvatar: attachment.message!.sender?.avatarUrl || null,
        sentAt: attachment.message!.createdAt,
      }));

    const nextCursor =
      attachments.length > pageSize ? attachments[pageSize].id : null;

    return res.json({ success: true, data: { medias, nextCursor } });
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des medias du canal :",
      error,
    );
    return res.json({
      success: false,
      message: "Erreur interne du serveur",
      name: "server-error",
    });
  }
}

export async function getUnreadRoomsCount(req: Request, res: Response) {
  try {
    const { userData, user } = await validateUser(req, res);
    if (!user || !userData) {
      return res.json({
        success: false,
        message: "Utilisateur non authentifié.",
        name: "unauthorized",
      } as ApiResponse<null>);
    }
    const userId = user.id;

    const unreadCount = await prisma.room.count({
      where: {
        members: {
          some: {
            AND: [
              { userId },
              {
                joinedAt: {
                  lte: new Date(),
                },
              },
              { OR: [{ leftAt: { lt: new Date() } }, { leftAt: null }] },
            ],
          },
        },
        messages: {
          some: {
            AND: [
              { type: { not: "CREATE" } },
              {
                reads: {
                  none: {
                    userId,
                  },
                },
              },
              {
                OR: [
                  {
                    AND: [
                      { senderId: { not: userId } },
                      {
                        type: {
                          not: "REACTION",
                        },
                      },
                    ],
                  },
                  {
                    AND: [
                      {
                        type: "REACTION",
                      },
                      {
                        OR: [{ recipientId: userId }, { senderId: userId }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
    });
    return unreadCount;
  } catch (error) {}
}

export async function getUnreadMessagesCount(req: Request, res: Response) {
  const roomId = req.params.roomId;

  try {
    const { userData, user } = await validateUser(req, res);
    if (!user || !userData) {
      return res.json({
        success: false,
        message: "Utilisateur non authentifié.",
        name: "unauthorized",
      } as ApiResponse<null>);
    }
    const userId = user.id;

    if (roomId === `saved-${userId}`) {
      return res.json({ success: true, data: { unreadCount: 0 } });
    }

    const roomMember = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: user.id } },
    });

    if (!roomMember) {
      return res.json({ success: true, data: { unreadCount: 0 } });
    }

    const unreadCount = await prisma.message.count({
      where: {
        roomId,
        createdAt: {
          gt: roomMember.joinedAt,
          lt: roomMember.leftAt || undefined,
        },
        senderId: { not: userId },
        reads: { none: { userId } },
        OR: [
          { type: { not: "REACTION" } },
          {
            AND: [
              { type: "REACTION" },
              { OR: [{ recipientId: userId }, { senderId: userId }] },
            ],
          },
        ],
        NOT: { AND: [{ type: "CREATE" }, { senderId: userId }] },
      },
    });

    return res.json({ success: true, data: { unreadCount } });
  } catch (error) {
    console.error(
      "Erreur lors de la récupération du compteur de messages non lus :",
      error,
    );
    return res.json({
      success: false,
      message: "Erreur interne du serveur",
      name: "server-error",
    });
  }
}

export async function getMessageUsersByFilter(req: Request, res: Response) {
  const filter = req.params.filter;
  const searchQuery = (req.query.q as string) || undefined;
  const cursor = (req.query.cursor as string) || undefined;
  const pageSize = 10;

  try {
    const { userData, user } = await validateUser(req, res);
    if (!user || !userData) {
      return res.json({
        success: false,
        message: "Utilisateur non authentifié.",
        name: "unauthorized",
      } as ApiResponse<null>);
    }

    let whereClause: Prisma.UserWhereInput = {};
    const searchCondition: Prisma.UserWhereInput | undefined = searchQuery
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
    const usersPage =
      users.length > pageSize ? users.slice(0, pageSize) : users;

    return res.json({ success: true, data: { users: usersPage, nextCursor } });
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs :", error);
    return res.json({
      success: false,
      message: "Erreur interne du serveur",
      name: "server-error",
    });
  }
}

export async function searchMessageUsers(req: Request, res: Response) {
  try {
    const cursor = req.query.cursor as string | undefined;
    const searchQuery = req.query.q as string | undefined;
    const pageSize = 10;

    const { userData, user } = await validateUser(req, res);
    if (!user || !userData) {
      return res.json({
        success: false,
        message: "Utilisateur non authentifié.",
        name: "unauthorized",
      } as ApiResponse<null>);
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
        select: getUserDataSelect(userId),
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
      req.headers,
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
