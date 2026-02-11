import { PrismaClient, Prisma } from "@prisma/client";
import {
  getChatRoomDataInclude,
  getMessageDataInclude,
  MessageData,
  RoomData,
  SocketStartChatEvent,
  SocketAddReactionEvent,
  SocketRemoveReactionEvent,
  SocketDeleteMessageEvent,
  SocketSendMessageEvent,
} from "./types";
import { getFormattedRooms, getMessageReads, getMessageDeliveries, getMessageReactions, getUnreadRoomsCount } from "./utils";

const prisma = new PrismaClient();

// --- HANDLE START CHAT ---
export async function handleStartChat(
  data: SocketStartChatEvent,
  userId: string,
): Promise<{ newRoom: RoomData; otherMemberIds: string[] } | RoomData> {
  const { targetUserId, isGroup, name, membersIds } = data;

  let rawMembers = isGroup
    ? [...(membersIds || []), userId]
    : [userId, targetUserId];

  const uniqueMemberIds = [...new Set(rawMembers)].filter((id) => id);

  if (isGroup && uniqueMemberIds.length < 2) {
    throw new Error("Un groupe doit avoir au moins 2 membres valides.");
  }

  if (!isGroup) {
    const existingRoom = await prisma.room.findFirst({
      where: {
        isGroup: false,
        AND: [
          { members: { some: { userId: uniqueMemberIds[0] } } },
          { members: { some: { userId: uniqueMemberIds[1] } } },
        ],
      },
      include: getChatRoomDataInclude(),
    });

    if (existingRoom) {
      return existingRoom as unknown as RoomData;
    }
  }

  const newRoom = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const room = await tx.room.create({
      data: {
        name: isGroup ? name : null,
        isGroup: isGroup,
        members: {
          create: uniqueMemberIds.map((id) => ({
            userId: id,
            type: isGroup && id === userId ? "OWNER" : "MEMBER",
          })),
        },
      },
      include: getChatRoomDataInclude(),
    });

    const message = await tx.message.create({
      data: {
        content: "created",
        roomId: room.id,
        senderId: userId,
        type: "CREATE",
      },
      include: getMessageDataInclude(userId),
    });

    for (const memberId of uniqueMemberIds) {
      await tx.lastMessage.upsert({
        where: {
          userId_roomId: { userId: memberId, roomId: room.id },
        },
        update: { messageId: message.id, createdAt: message.createdAt },
        create: {
          userId: memberId,
          roomId: room.id,
          messageId: message.id,
        },
      });
    }

    return { ...room, messages: [message] };
  });

  return {
    newRoom: newRoom as RoomData,
    otherMemberIds: uniqueMemberIds.filter((id) => id !== userId),
  };
}

// --- HANDLE MARK MESSAGE READ ---
export async function handleMarkMessageRead(
  messageId: string,
  roomId: string,
  userId: string,
) {
  if (!roomId.startsWith("saved-")) {
    const membership = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (!membership || membership.type === "BANNED" || membership.leftAt) {
      throw new Error("Non autorisé");
    }
  }

  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });

  if (!message) throw new Error("Message not found");

  await prisma.read.upsert({
    where: {
      userId_messageId: {
        userId: userId,
        messageId,
      },
    },
    create: {
      userId: userId,
      messageId,
    },
    update: {},
  });

  const updatedReads = await getMessageReads(messageId);
  const newUnreadCount = await getUnreadRoomsCount(userId);

  return {
    reads: updatedReads,
    unreadCount: newUnreadCount,
  };
}

// --- HANDLE MARK MESSAGE DELIVERED ---
export async function handleMarkMessageDelivered(
  messageId: string,
  roomId: string,
  userId: string,
) {
  if (!roomId.startsWith("saved-")) {
    const membership = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (!membership || membership.type === "BANNED" || membership.leftAt) {
      throw new Error("Non autorisé");
    }
  }

  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });

  if (!message) throw new Error("Message not found");

  await prisma.delivery.upsert({
    where: {
      userId_messageId: {
        userId: userId,
        messageId,
      },
    },
    create: {
      userId: userId,
      messageId,
    },
    update: {},
  });

  const updatedDeliveries = await getMessageDeliveries(messageId);

  return {
    deliveries: updatedDeliveries,
  };
}

// --- HANDLE ADD REACTION ---
export async function handleAddReaction(
  data: SocketAddReactionEvent,
  userId: string,
  username: string,
) {
  const { messageId, roomId, content } = data;

  if (!roomId.startsWith("saved-")) {
    const membership = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!membership || membership.type === "BANNED" || membership.leftAt) {
      throw new Error("Non autorisé");
    }
  }

  const originalMessage = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      senderId: true,
      roomId: true,
      sender: { select: { id: true, username: true } },
    },
  });

  if (!originalMessage || !originalMessage.senderId) throw new Error("Message not found");

  const reaction = await prisma.reaction.upsert({
    where: {
      userId_messageId: {
        userId,
        messageId,
      },
    },
    create: {
      userId,
      messageId,
      content,
    },
    update: {
      content,
      createdAt: new Date(),
    },
    select: { id: true },
  });

  let affectedUserIds: string[] = [];

  if (userId !== originalMessage.senderId) {
    await prisma.message.deleteMany({
      where: {
        senderId: userId,
        recipientId: originalMessage.senderId,
        roomId: originalMessage.roomId,
        type: "REACTION",
        reactionId: reaction.id,
      },
    });

    const reactionMessage = await prisma.message.create({
      data: {
        senderId: userId,
        recipientId: originalMessage.senderId,
        type: "REACTION",
        content: content,
        roomId,
        reactionId: reaction.id,
      },
    });

    if (reactionMessage.id && roomId) {
      await prisma.lastMessage.deleteMany({
        where: {
          roomId,
          userId: { in: [userId, originalMessage.senderId] },
        },
      });

      await prisma.lastMessage.createMany({
        data: [
          {
            userId,
            roomId,
            messageId: reactionMessage.id,
          },
          {
            userId: originalMessage.senderId,
            roomId,
            messageId: reactionMessage.id,
          },
        ],
      });

      affectedUserIds = [userId, originalMessage.senderId];
    }
  }

  const reactionsData = await getMessageReactions(messageId, userId);

  return {
    reactions: reactionsData,
    affectedUserIds,
    senderUsername: originalMessage.sender?.username,
  };
}

// --- HANDLE REMOVE REACTION ---
export async function handleRemoveReaction(
  data: SocketRemoveReactionEvent,
  userId: string,
  username: string,
) {
  const { messageId, roomId } = data;

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      senderId: true,
      roomId: true,
      sender: { select: { id: true, username: true } },
      reactions: {
        where: { userId },
        select: { id: true },
      },
    },
  });

  if (!message || !message.reactions[0])
    throw new Error("Reaction not found");

  const reactionId = message.reactions[0].id;
  const originalSenderId = message.senderId;

  if (!originalSenderId) throw new Error("Invalid message state");

  await prisma.$transaction([
    prisma.reaction.delete({
      where: { id: reactionId },
    }),
    prisma.message.deleteMany({
      where: {
        senderId: userId,
        recipientId: originalSenderId,
        roomId: message.roomId,
        reactionId: reactionId,
        type: "REACTION",
      },
    }),
  ]);

  let affectedUserIds: string[] = [];

  if (originalSenderId && message.roomId) {
    const refreshLastMessage = async (targetId: string) => {
      const lastValidMessage = await prisma.message.findFirst({
        where: { roomId: message.roomId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

      if (lastValidMessage) {
        await prisma.lastMessage.upsert({
          where: {
            userId_roomId: {
              userId: targetId,
              roomId,
            },
          },
          create: {
            userId: targetId,
            roomId,
            messageId: lastValidMessage.id,
          },
          update: { messageId: lastValidMessage.id },
        });
      } else {
        await prisma.lastMessage.deleteMany({
          where: { userId: targetId, roomId },
        });
      }
    };

    await Promise.all([
      refreshLastMessage(userId),
      refreshLastMessage(originalSenderId),
    ]);

    affectedUserIds = [userId, originalSenderId];
  }

  const reactionsData = await getMessageReactions(messageId, userId);

  return {
    reactions: reactionsData,
    affectedUserIds,
    senderUsername: message.sender?.username,
  };
}

// --- HANDLE DELETE MESSAGE ---
export async function handleDeleteMessage(
  data: SocketDeleteMessageEvent,
  userId: string,
  username: string,
) {
  const { messageId, roomId } = data;

  const messageToDelete = await prisma.message.findUnique({
    where: { id: messageId },
  });

  if (!messageToDelete || !messageToDelete.senderId) throw new Error("Message not found");

  if (messageToDelete.senderId !== userId) {
    throw new Error("Non autorisé");
  }

  const attachments = await prisma.messageAttachment.findMany({
    where: { messageId },
  });

  if (roomId === "saved-" + userId) {
    await prisma.message.delete({
      where: { id: messageId },
    });

    return {
      isSavedRoom: true,
      attachmentIds: attachments.map((a) => a.id),
      affectedUserIds: [userId],
    };
  }

  await prisma.$transaction(async (tx) => {
    const nextLatestMessage = await tx.message.findFirst({
      where: {
        roomId: roomId,
        id: { not: messageId },
      },
      orderBy: { createdAt: "desc" },
    });

    if (nextLatestMessage) {
      await tx.lastMessage.updateMany({
        where: {
          roomId: roomId,
          messageId: messageId,
        },
        data: {
          messageId: nextLatestMessage.id,
          createdAt: nextLatestMessage.createdAt,
        },
      });
    } else {
      await tx.lastMessage.deleteMany({
        where: { roomId: roomId, messageId: messageId },
      });
    }

    await tx.message.delete({
      where: { id: messageId },
    });
  });

  const activeMembers = await prisma.roomMember.findMany({
    where: { roomId, leftAt: null, type: { not: "BANNED" } },
    include: { user: true },
  });

  const affectedUserIds = activeMembers
    .map((m) => m.userId)
    .filter((id): id is string => id !== null);

  return {
    isSavedRoom: false,
    attachmentIds: attachments.map((a) => a.id),
    affectedUserIds,
  };
}

// --- HANDLE SEND SAVED MESSAGE ---
export async function handleSendSavedMessage(
  data: SocketSendMessageEvent,
  userId: string,
) {
  const { content, roomId, attachmentIds = [] } = data;

  const createdSavedMessage = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const msg = await tx.message.create({
      data: {
        content,
        senderId: userId,
        type: "SAVED",
      },
    });

    if (attachmentIds && attachmentIds.length > 0) {
      await tx.messageAttachment.updateMany({
        where: { id: { in: attachmentIds } },
        data: { messageId: msg.id },
      });
    }

    return msg;
  });

  const completeSavedMsg = await prisma.message.findUnique({
    where: { id: createdSavedMessage.id },
    include: getMessageDataInclude(userId),
  });

  if (!completeSavedMsg) throw new Error("Failed to create saved message");

  let emissionType = "CONTENT";
  if (content === "create-" + userId) {
    emissionType = "SAVED";
  }

  const newMessage = { ...completeSavedMsg, type: emissionType } as MessageData;

  return {
    newMessage,
    galleryMedias: newMessage.attachments?.map((att) => ({
      id: att.id,
      type: att.type,
      url: att.url,
      publicId: att.publicId,
      width: att.width,
      height: att.height,
      format: att.format,
      resourceType: att.resourceType,
      messageId: newMessage.id,
      senderUsername: newMessage.sender?.username,
      senderAvatar: newMessage.sender?.avatarUrl,
      sentAt: newMessage.createdAt,
    })),
  };
}

// --- HANDLE SEND NORMAL MESSAGE ---
export async function handleSendNormalMessage(
  data: SocketSendMessageEvent,
  userId: string,
  username: string,
) {
  const { content, roomId, type, recipientId, attachmentIds = [] } = data;

  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });

  if (!membership || membership.type === "BANNED" || membership.leftAt) {
    throw new Error("Non autorisé");
  }

  const { createdMessage, roomData } = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const msg = await tx.message.create({
        data: {
          content,
          roomId,
          senderId: userId,
          type,
          recipientId,
        },
      });

      if (attachmentIds && attachmentIds.length > 0) {
        const existingAttachments = await tx.messageAttachment.findMany({
          where: {
            id: { in: attachmentIds },
          },
        });

        if (existingAttachments.length !== attachmentIds.length) {
          console.warn("Some attachment IDs do not exist:", {
            requested: attachmentIds,
            found: existingAttachments.map((a) => a.id),
          });
        }

        await tx.messageAttachment.updateMany({
          where: {
            id: { in: attachmentIds },
          },
          data: {
            messageId: msg.id,
          },
        });
      }

      const room = await tx.room.findUnique({
        where: { id: roomId },
        include: getChatRoomDataInclude(),
      });

      return { createdMessage: msg, roomData: room };
    },
  );

  const newMessage = await prisma.message.findUnique({
    where: { id: createdMessage.id },
    include: getMessageDataInclude(userId),
  });

  if (!newMessage) throw new Error("Failed to create message");

  const activeMembers = await prisma.roomMember.findMany({
    where: { roomId, leftAt: null, type: { not: "BANNED" } },
    include: { user: true },
  });

  for (const member of activeMembers) {
    if (member.userId) {
      await prisma.lastMessage.upsert({
        where: { userId_roomId: { userId: member.userId, roomId } },
        create: {
          userId: member.userId,
          roomId,
          messageId: newMessage.id,
        },
        update: { messageId: newMessage.id, createdAt: new Date() },
      });
    }
  }

  const affectedUserIds = activeMembers
    .map((m) => m.userId)
    .filter((id): id is string => id !== null);

  return {
    newMessage,
    newRoom: roomData,
    galleryMedias: newMessage.attachments?.map((att) => ({
      id: att.id,
      type: att.type,
      url: att.url,
      publicId: att.publicId,
      width: att.width,
      height: att.height,
      format: att.format,
      resourceType: att.resourceType,
      messageId: newMessage.id,
      senderUsername: newMessage.sender?.username,
      senderAvatar: newMessage.sender?.avatarUrl,
      sentAt: newMessage.createdAt,
    })),
    affectedUserIds,
  };
}
