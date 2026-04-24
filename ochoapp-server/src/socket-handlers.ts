import { PrismaClient, Prisma } from "@prisma/client";
import {
  getChatRoomDataInclude,
  getMessageDataInclude,
  getUserDataSelect,
  MessageData,
  RoomData,
  SocketStartChatEvent,
  SocketAddReactionEvent,
  SocketRemoveReactionEvent,
  SocketDeleteMessageEvent,
  SocketSendMessageEvent,
  SocketSendVoiceNoteEvent,
  SocketGetRoomDetailsEvent,
  SocketGetLastMessageEvent,
} from "./types";
import { getFormattedRooms, getMessageReads, getMessageDeliveries, getMessageReactions, getUnreadRoomsCount } from "./utils";
import { parseMentions, validateMentions, createMessageMentions } from "./mention-utils";
import { Server } from "socket.io";
import { UploadApiErrorResponse, UploadApiResponse } from "cloudinary";


interface CloudinaryApi {
  uploader: {
    upload_stream: (options: any, callback: (error: any, result: any) => void) => NodeJS.WritableStream;
    destroy: (publicId: string, options?: any, callback?: (error: any, result: any) => void) => Promise<any> | void;
  };
}

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
  if (!originalMessage) throw new Error("Message not found");

  if (!originalMessage.senderId) {
    throw new Error("Invalid message state: senderId is not set");
  }

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
  if (!message) throw new Error("Message not found");

  if (!message.reactions[0])
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
  cloudinary?: CloudinaryApi,
) {
  const { messageId, roomId } = data;

  const messageToDelete = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      attachments: true,
      voiceNote: true,
    },
  });
  if (!messageToDelete) {
    // Already deleted
    return {
      isSavedRoom: roomId.startsWith("saved-"),
      attachmentIds: [],
      affectedUserIds: [userId],
    };
  }

  if (!messageToDelete.senderId) throw new Error("Message not found");

  if (messageToDelete.senderId !== userId) {
    throw new Error("Non autorisé");
  }

  const attachments = await prisma.messageAttachment.findMany({
    where: { messageId },
  });

  // Delete voice note from Cloudinary if exists
  if (messageToDelete.voiceNote && messageToDelete.voiceNote.publicId && cloudinary) {
    try {
      await new Promise<void>((resolve, reject) => {
        cloudinary.uploader.destroy(
          messageToDelete.voiceNote!.publicId!,
          { invalidate: true },
          (error: UploadApiErrorResponse, result: UploadApiResponse) => {
            if (error) reject(error);
            else resolve();
          }
        );
      });
    } catch (error) {
      console.error(`Failed to delete voice note from Cloudinary: ${error}`);
      // Continue with message deletion even if Cloudinary delete fails
    }
  }

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

    // Mark saved message as delivered for the user (saved messages are always delivered)
    await tx.delivery.create({
      data: {
        userId,
        messageId: msg.id,
      },
    });

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
      fileName: att.fileName,
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

// --- HANDLE SEND SAVED VOICE NOTE ---
export async function handleSendSavedVoiceNote(
  data: SocketSendVoiceNoteEvent,
  userId: string,
  cloudinary: CloudinaryApi,
) {
  const { voiceNoteBase64, duration } = data;

  // Convertir base64 en buffer
  const buffer = Buffer.from(voiceNoteBase64.replace(/^data:audio\/[a-z]+;base64,/, ''), 'base64');

  // Upload à Cloudinary
  let voiceNoteUrl = '';
  let publicId = '';
  try {
    const uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'video',
          format: 'mp3',
          flags: 'immutable_cache',
          folder: 'ochoapp/voice_notes',
        },
        (error: UploadApiErrorResponse, result: UploadApiResponse) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(buffer);
    });
    voiceNoteUrl = uploadResult.secure_url;
    publicId = uploadResult.public_id;
  } catch (error) {
    throw new Error(`Failed to upload voice note: ${error}`);
  }

  // Créer le message et la note vocale
  const createdMessage = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const msg = await tx.message.create({
        data: {
          senderId: userId,
          type: "VOICENOTE",
        },
      });

      // Créer la note vocale
      await tx.voiceNote.create({
        data: {
          url: voiceNoteUrl,
          publicId: publicId,
          duration: Math.round(duration * 1000), // Convertir en millisecondes
          messageId: msg.id,
        },
      });

      // Mark saved voice note as delivered for the user
      await tx.delivery.create({
        data: {
          userId,
          messageId: msg.id,
        },
      });

      return msg;
    },
  );

  // Recharger le message avec toutes les données incluant voiceNote
  const completeSavedMsg = await prisma.message.findUnique({
    where: { id: createdMessage.id },
    include: getMessageDataInclude(userId),
  });

  if (!completeSavedMsg) throw new Error("Failed to create saved voice note");

  // Pour les saved rooms, on retourne le type comme "VOICENOTE" mais avec emission type "SAVED"
  const newMessage = { ...completeSavedMsg, type: "VOICENOTE" } as MessageData;

  return {
    newMessage,
  };
}

// --- HANDLE SEND NORMAL MESSAGE ---
export async function handleSendNormalMessage(
  data: SocketSendMessageEvent,
  userId: string,
  username: string,
  io: Server,
) {
  const { content, roomId, type, recipientId, attachmentIds = []} = data;

  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });

  if (!membership || membership.type === "BANNED" || membership.leftAt) {
    throw new Error("Non autorisé");
  }

  // Récupérer les infos de la room pour déterminer si c'est un DM
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { members: true },
  });

  if (!room) throw new Error("Room not found");

  // Calculer le recipientId pour les messages directs (1v1)
  let calculatedRecipientId = recipientId;
  if (!room.isGroup && type === "CONTENT") {
    // Pour un DM: trouver l'autre utilisateur
    const otherMember = room.members.find(m => m.userId && m.userId !== userId);
    if (otherMember?.userId) {
      calculatedRecipientId = otherMember.userId;
    }
  }

  const { createdMessage, roomData } = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const msg = await tx.message.create({
        data: {
          content,
          roomId,
          senderId: userId,
          type,
          recipientId: calculatedRecipientId,
        },
        include: getMessageDataInclude(userId),
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

      // Fetch active members for lastMessage updates
      const activeMembers = await tx.roomMember.findMany({
        where: { roomId, leftAt: null, type: { not: "BANNED" } },
      });

      // Update lastMessage INSIDE transaction only
      for (const member of activeMembers) {
        if (member.userId) {
          await tx.lastMessage.upsert({
            where: { userId_roomId: { userId: member.userId, roomId } },
            create: {
              userId: member.userId,
              roomId,
              messageId: msg.id,
            },
            update: { messageId: msg.id, createdAt: new Date() },
          });
        }
      }

      return { createdMessage: msg, roomData: room };
    },
  );

  const newMessage = await prisma.message.findUnique({
    where: { id: createdMessage.id },
    include: getMessageDataInclude(userId),
  });

  if (!newMessage) throw new Error("Failed to create message");

  // Get affected users
  const affectedUserIds = (roomData?.members || [])
    .map((m) => m.userId)
    .filter((id): id is string => id !== null);

  const deliveredUserIds: string[] = [];

  // --- HANDLE MENTIONS ---
  // Process mentions as part of the message (treated as unread messages)
  if (type === "CONTENT" || type === "SAVED") {
    try {
      // Parse mentions from content
      const parsedMentions = parseMentions(content);

      if (parsedMentions.length > 0) {
        // Validate mentions (check user exists and is room member)
        const { valid: validMentions } = await validateMentions(
          parsedMentions,
          roomId
        );

        // Create MessageMention records for display in message details
        if (validMentions.length > 0) {
          await createMessageMentions(newMessage.id, validMentions);
          console.log(`Created ${validMentions.length} message mentions`);
        }
      }
    } catch (error) {
      console.error("Error processing mentions:", error);
      // Don't fail the message send, just log the error
    }
  }

  return {
    newMessage,
    newRoom: roomData,
    galleryMedias: newMessage.attachments?.map((att) => ({
      id: att.id,
      type: att.type,
      url: att.url,
      publicId: att.publicId,
      fileName: att.fileName,
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
    deliveredUserIds,
  };
}

export async function markUndeliveredMessages(
  userId: string,
  io: Server,
): Promise<void> {
  try {
    // Récupérer toutes les rooms de l'utilisateur
    const rooms = await prisma.room.findMany({
      where: {
        members: {
          some: {
            AND: [
              { userId },
              { type: { not: "BANNED" } },
              { leftAt: null },
            ],
          },
        },
      },
      select: {
        id: true,
        messages: {
          where: {
            type: { not: "CREATE" },
            deliveries: {
              none: { userId },
            },
          },
          select: {
            id: true,
            senderId: true,
            roomId: true,
          },
        },
      },
    });

    // Pour chaque room et ses messages non livrés
    for (const room of rooms) {
      if (room.messages.length === 0) continue;

      const socketsInRoom = io.sockets.adapter.rooms.get(room.id);
      if (!socketsInRoom) continue;

      for (const message of room.messages) {
        // Vérifier si le sender est dans la room (via les sockets)
        const senderInRoom = Array.from(socketsInRoom).some((socketId) => {
          const socket = io.sockets.sockets.get(socketId);
          return socket?.data?.user?.id === message.senderId;
        });

        if (senderInRoom) {
          // Marquer le message comme livré
          await prisma.delivery.upsert({
            where: {
              userId_messageId: {
                userId,
                messageId: message.id,
              },
            },
            create: {
              userId,
              messageId: message.id,
            },
            update: {},
          });

          // Notifier le sender que le message est livré
          const updatedDeliveries = await getMessageDeliveries(message.id);
          io.to(room.id).emit("message_delivered_update", {
            messageId: message.id,
            deliveries: updatedDeliveries,
          });
        }
      }
    }
  } catch (error) {
    console.error(
      "Erreur markUndeliveredMessages lors de la connexion:",
      error
    );
  }
}

// --- HANDLE GET ROOM DETAILS ---
export async function handleGetRoomDetails(
  data: SocketGetRoomDetailsEvent,
  userId: string,
): Promise<RoomData> {
  const { roomId } = data;

  if (roomId === `saved-${userId}`) {
    // Handle saved messages room - récupérer les messages SAVED texte et les VOICENOTE sans roomId
    const existingSavedMsgs = await prisma.message.findMany({
      where: {
        senderId: userId,
        OR: [
          { type: "SAVED" },
          { 
            type: "VOICENOTE",
            roomId: null, // VoiceNote sauvegardée (pas associée à une room)
          },
        ],
      },
      include: getMessageDataInclude(userId),
      take: 3,
      orderBy: { createdAt: "desc" },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: getUserDataSelect(""),
    });

    if (!user) throw new Error("User not found");

    const createInfo = await prisma.message.findFirst({
      where: {
        senderId: userId,
        type: "SAVED",
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      id: `saved-${userId}`,
      name: null,
      description: null,
      groupAvatarUrl: null,
      privilege: "MANAGE",
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
      maxMembers: 300,
      messages: existingSavedMsgs,
      isGroup: false,
      createdAt: createInfo?.createdAt || new Date(),
    };
  } else {
    // Check membership
    const membership = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (!membership || membership.type === "BANNED") {
      throw new Error("Non autorisé");
    }

    const isFormerMember = membership.leftAt !== null;

    // Get room data
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: getChatRoomDataInclude(userId),
    });

    if (!room) throw new Error("Room not found");

    // Get 3 latest unread messages (before leftAt for former members)
    const unreadMessages = await prisma.message.findMany({
      where: {
        roomId,
        type: { not: "CREATE" },
        reads: {
          none: { userId },
        },
        senderId: { not: userId },
        ...(isFormerMember && membership.leftAt ? { createdAt: { lt: membership.leftAt } } : {}),
      },
      include: getMessageDataInclude(userId),
      take: 3,
      orderBy: { createdAt: "desc" },
    });

    return {
      ...room,
      messages: unreadMessages,
    };
  }
}

// --- HANDLE GET LAST MESSAGE ---
export async function handleGetLastMessage(
  data: SocketGetLastMessageEvent,
  userId: string,
): Promise<MessageData> {
  const { roomId } = data;

  const isSaved = roomId === `saved-${userId}`;

  if (isSaved) {
    const lastSavedMessage = await prisma.message.findFirst({
      where: {
        senderId: userId,
        OR: [
          { type: "SAVED" },
          { 
            type: "VOICENOTE",
            roomId: null, // VoiceNote sauvegardée (pas associée à une room)
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: getMessageDataInclude(userId),
    });

    if (!lastSavedMessage) {
      throw new Error("Aucun message enregistré trouvé.");
    }

    // Format saved messages
    if (lastSavedMessage.type === "SAVED" && lastSavedMessage.content !== `create-${userId}`) {
      return { ...lastSavedMessage, type: "CONTENT" };
    }
    return lastSavedMessage;
  }

  // Check membership for regular rooms
  const member = await prisma.roomMember.findUnique({
    where: {
      roomId_userId: {
        roomId,
        userId,
      },
    },
  });

  if (!member) {
    throw new Error("Utilisateur non trouvé.");
  }

  if (member.type === "BANNED") {
    throw new Error("Utilisateur banni.");
  }

  const leftDate = member.leftAt;

  const lastMessage = await prisma.message.findFirst({
    where: {
      roomId,
      createdAt: { lte: leftDate || undefined },
    },
    orderBy: { createdAt: "desc" },
    include: getMessageDataInclude(userId),
  });

  if (!lastMessage) {
    throw new Error("Aucun message trouvé.");
  }

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


  return lastMessage;
}

// --- HANDLE SEND VOICE NOTE ---
export async function handleSendVoiceNote(
  data: SocketSendVoiceNoteEvent,
  userId: string,
  username: string,
  io: Server,
  cloudinary: CloudinaryApi,
) {
  const { voiceNoteBase64, duration, roomId, tempId, recipientId } = data;

  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });

  if (!membership || membership.type === "BANNED" || membership.leftAt) {
    throw new Error("Non autorisé");
  }

  // Récupérer les infos de la room
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { members: true },
  });

  if (!room) throw new Error("Room not found");

  // Calculer le recipientId pour les messages directs
  let calculatedRecipientId = recipientId;
  if (!room.isGroup) {
    const otherMember = room.members.find(m => m.userId && m.userId !== userId);
    if (otherMember?.userId) {
      calculatedRecipientId = otherMember.userId;
    }
  }

  // Convertir base64 en buffer
  const buffer = Buffer.from(voiceNoteBase64.replace(/^data:audio\/[a-z]+;base64,/, ''), 'base64');

  // Upload à Cloudinary
  let voiceNoteUrl = '';
  let publicId = '';
  try {
    const uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'video',
          format: 'mp3',
          flags: 'immutable_cache',
          folder: 'ochoapp/voice_notes',
        },
        (error: UploadApiErrorResponse, result: UploadApiResponse) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(buffer);
    });
    voiceNoteUrl = uploadResult.secure_url;
    publicId = uploadResult.public_id;
  } catch (error) {
    throw new Error(`Failed to upload voice note: ${error}`);
  }

  // Créer le message et la note vocale
  const createdMessage = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const msg = await tx.message.create({
        data: {
          roomId,
          senderId: userId,
          type: "VOICENOTE",
          recipientId: calculatedRecipientId,
        },
      });

      // Créer la note vocale
      await tx.voiceNote.create({
        data: {
          url: voiceNoteUrl,
          publicId: publicId,
          duration: Math.round(duration * 1000), // Convertir en millisecondes
          messageId: msg.id,
        },
      });

      // Mettre à jour lastMessage pour tous les membres actifs
      const activeMembers = await tx.roomMember.findMany({
        where: { roomId, leftAt: null, type: { not: "BANNED" } },
      });

      for (const member of activeMembers) {
        if (member.userId) {
          await tx.lastMessage.upsert({
            where: { userId_roomId: { userId: member.userId, roomId } },
            create: {
              userId: member.userId,
              roomId,
              messageId: msg.id,
            },
            update: { messageId: msg.id, createdAt: new Date() },
          });
        }
      }

      return msg;
    },
  );

  // Recharger le message avec toutes les données incluant voiceNote
  const completeMessage = await prisma.message.findUnique({
    where: { id: createdMessage.id },
    include: getMessageDataInclude(userId),
  });

  if (!completeMessage) throw new Error("Failed to load created voice note message");

  return {
    newMessage: completeMessage,
    tempId,
  };
}
