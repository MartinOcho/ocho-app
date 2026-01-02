"use server";

import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import {
  RoomData,
  getChatRoomDataInclude,
  getMessageDataInclude,
  getUserDataSelect,
  MessageData,
  UserData,
} from "@/lib/types";
import {
  addAdminSchema,
  addMemberSchema,
  createRoomSchema,
  createMessageSchema,
  memberActionSchema,
} from "@/lib/validation";

export async function submitMessage(input: {
  content: string;
  roomId: string;
}) {
  const { user } = await validateRequest();

  if (!user) {
    throw new Error("Action non autorisée");
  }

  const userId = user.id;
  const { content, roomId } = createMessageSchema.parse(input);

  // Vérifier si le message est envoyé à soi-même (message sauvegardé)
  const isSavedMessage = roomId === `saved-${userId}`;

  if (isSavedMessage) {
    // Créer uniquement le message sans canal
    const newMessage = await prisma.message.create({
      data: {
        content,
        senderId: user.id,
        type: "SAVED",
      },
      include: getMessageDataInclude(userId),
    });

    const messageId = newMessage.id;
    await prisma.read.upsert({
      where: {
        userId_messageId: {
          userId,
          messageId,
        },
      },
      create: {
        userId,
        messageId,
      },
      update: {},
    });

    newMessage.type = "CONTENT";

    return { newMessage, roomId, userId, newRoom: null }; // Pas de nouveau canal
  }

  // Si ce n'est pas un message sauvegardé, créer un message et vérifier le canal
  const [newMessage, newRoom] = await prisma.$transaction([
    prisma.message.create({
      data: {
        content,
        roomId: roomId,
        senderId: user.id,
        type: "CONTENT",
      },
      include: getMessageDataInclude(userId),
    }),
    prisma.room.findFirst({
      where: {
        id: roomId,
      },
      include: getChatRoomDataInclude(),
    }),
  ]);

  const messageId = newMessage.id;

  const roomMembers = await prisma.roomMember.findMany({
    where: {
      roomId,
    },
    select: {
      userId: true,
      leftAt: true,
    },
  });
  
  for (const member of roomMembers) {
    const memberId = member.userId;
    if (member.leftAt) {
      continue;
    }
    if (!memberId) {
      continue;
    }
    const lastMessage = await prisma.lastMessage.findFirst({
      where: {
        userId: memberId,
        roomId,
      },
    });
    if (lastMessage) {
      await prisma.lastMessage.update({
        where: {
          userId_roomId: {
            userId: memberId,
            roomId,
          },
        },
        data: {
          messageId,
          createdAt: new Date(),
        },
      });
      continue;
    }
    await prisma.lastMessage.create({
      data: {
        userId,
        roomId,
        messageId,
      },
    });
  }

  await prisma.read.upsert({
    where: {
      userId_messageId: {
        userId,
        messageId,
      },
    },
    create: {
      userId,
      messageId,
    },
    update: {},
  });

  return { newMessage, roomId, userId, newRoom };
}

export async function deleteMessage(id: string) {
  const { user } = await validateRequest();

  if (!user) {
    throw new Error("Action non autorisée");
  }

  const message = await prisma.message.findUnique({
    where: { id },
  });
  if (!message) {
    throw new Error("Commentaire non trouve");
  }
  if (message.senderId !== user.id) {
    throw new Error("Action non autorisée");
  }

  const deletedMessage = await prisma.message.delete({
    where: { id },
    include: getMessageDataInclude(user.id),
  });

  return deletedMessage;
}

export async function createChatRoom(input: {
  name: string | null;
  isGroup: boolean;
  members: string[];
}) {
  const { user } = await validateRequest();

  if (!user) {
    throw new Error("Action non autorisée");
  }

  const userId = user.id;

  const { name, isGroup, members } = createRoomSchema.parse(input);

  (!members?.includes(userId) || members.length === 1) &&
    members?.unshift(userId);

  if (!members?.length) {
    throw new Error("Selectionnez au moins un utilisateur");
  }
  if (isGroup && members?.length < 2) {
    throw new Error("Un groupe doit avoir au moins deux membres");
  }
  if (!isGroup) {
    const existingRoom: RoomData | null = await prisma.room.findFirst({
      where: {
        isGroup: false,
        AND: [
          { members: { some: { userId: members[0] } } },
          { members: { some: { userId: members[1] } } },
        ],
      },
      include: getChatRoomDataInclude(),
    });
    if (existingRoom) {
      return { newRoom: existingRoom, userId };
    }
  }
  // Si le canal n'existe pas, le créer
  const newRoom: RoomData = await prisma.room.create({
    data: {
      name: name?.trim() || null,
      isGroup: isGroup,
      members: {
        create: members.map((memberId) => ({
          userId: memberId,
          type: isGroup && memberId === userId ? "OWNER" : "MEMBER",
        })),
      },
    },
    include: getChatRoomDataInclude(), // Inclure les données requises
  });

  const createMessage = await prisma.message.create({
    data: {
      content: "created",
      roomId: newRoom.id,
      senderId: newRoom.isGroup ? user.id : null,
      type: "CREATE",
    },
    include: getMessageDataInclude(user.id),
  });

  const newMembers: string[] = newRoom.members
    .map((member) => {
      return member.userId;
    })
    .filter((memberId) => memberId !== userId)
    .filter((member) => member !== null);
  if (newMembers && newMembers.length) {
    newMembers.map(async (memberId) => {
      const member = await prisma.roomMember.findUnique({
        where: {
          roomId_userId: {
            roomId: newRoom.id,
            userId: memberId,
          },
        },
        select: {
          user: { select: getUserDataSelect(memberId) },
        },
      });
      if (!member?.user) {
        return;
      }
      if (!newRoom.isGroup) {
        const lastMessage = await prisma.lastMessage.findFirst({
          where: {
            userId,
            roomId: newRoom.id,
          },
        });
        if (lastMessage) {
          await prisma.lastMessage.update({
            where: {
              userId_roomId: {
                userId,
                roomId: newRoom.id,
              },
            },
            data: {
              messageId: createMessage.id,
              createdAt: new Date(),
            },
          });
        } else {
          await prisma.lastMessage.create({
            data: {
              userId,
              roomId: newRoom.id,
              messageId: createMessage.id,
            },
          });
        }

        return createMessage;
      }
      const message = await prisma.message.create({
        data: {
          content: "add-" + member.user.id,
          senderId: userId,
          recipientId: member.user.id,
          type: "NEWMEMBER",
          roomId: newRoom.id,
        },
        include: getMessageDataInclude(user.id),
      });
      const lastMessage = await prisma.lastMessage.findFirst({
        where: {
          userId,
          roomId: newRoom.id,
        },
      });
      if (lastMessage) {
        await prisma.lastMessage.update({
          where: {
            userId_roomId: {
              userId,
              roomId: newRoom.id,
            }
          },
          data: {
            messageId: message.id,
            createdAt: new Date(),
          },
        });
      } else {
        await prisma.lastMessage.create({
          data: {
            userId,
            roomId: newRoom.id,
            messageId: message.id,
          },
        });
      }
      return message;
    });
  }

  const createInfo: MessageData = (await prisma.message.findFirst({
    where: {
      roomId: newRoom.id,
    },
    include: getMessageDataInclude(user.id),
    orderBy: {
      createdAt: "desc",
    },
    take: 1,
  })) as MessageData;

  return { newRoom, userId, createInfo };
}
export async function addMembers(input: {
  roomId: string;
  members: string[];
}) {
  const { user } = await validateRequest();

  if (!user) {
    throw new Error("Action non autorisée");
  }

  const userId = user.id;

  const { roomId, members } = addMemberSchema.parse(input);

  if (!members?.length) {
    throw new Error("Selectionnez au moins un utilisateur");
  }
  const room = await prisma.room.findUnique({
    where: {
      id: roomId,
    },
  });
  if (!room) {
    throw new Error("La discussion n'existe pas");
  }
  if (!room.isGroup) {
    throw new Error("Cette discussion n'est pas un groupe");
  }
  if (members.includes(userId)) {
    throw new Error("Vous êtes déjà membre de ce groupe");
  }
  const existingMembers = await prisma.roomMember.findMany({
    where: {
      roomId,
    },
  });
  if (existingMembers.length >= room.maxMembers) {
    throw new Error("Ce groupe est plein");
  }

  const newMembers = members.filter(
    (memberId) =>
      !existingMembers.some(
        (existingMember) => existingMember.userId === memberId,
      ),
  );

  const newMembersIds = newMembers.map((memberId) => ({
    userId: memberId,
    roomId: roomId,
  }));
  const newMembersCreated = await prisma.roomMember.createMany({
    data: newMembersIds,
  });

  if (!newMembersCreated) {
    throw new Error("Erreur lors de l'ajout des membres");
  }
  // Send info message for each created new member
  const sentInfoMessages = newMembers.map(async (memberId) => {
    const member = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId: memberId,
        },
      },
      select: {
        user: { select: getUserDataSelect(memberId) },
      },
    });
    if (!member?.user) {
      return;
    }
    const message = await prisma.message.create({
      data: {
        content: "add-" + member.user.id,
        senderId: userId,
        recipientId: member.user.id,
        type: "NEWMEMBER",
        roomId,
      },
      include: getMessageDataInclude(user.id),
    });
    await prisma.lastMessage.create({
      data: {
        userId: member.user.id,
        messageId: message.id,
        roomId,
      },
    });
    return message;
  });

  const lastMessage: MessageData | null = await prisma.message.findFirst({
    where: {
      roomId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 1,
    include: getMessageDataInclude(user.id),
  });

  // Fetch only new added members userdata
  const newMembersList = (
    await Promise.all(
      newMembers.map(async (memberId) => {
        const member = await prisma.roomMember.findUnique({
          where: {
            roomId_userId: {
              userId: memberId,
              roomId: roomId,
            },
          },
          select: {
            userId: true,
            user: {
              select: getUserDataSelect(memberId),
            },
          },
        });

        if (!member) {
          return undefined; // Explicitly return undefined
        }

        return member;
      }),
    )
  ).filter((member) => member !== undefined);

  return { newMembersList, userId, roomId, sentInfoMessages, lastMessage };
}
export async function addAdmin(input: { roomId: string; member: string }) {
  const { user } = await validateRequest();

  if (!user) {
    throw new Error("Action non autorisée");
  }

  const { roomId, member } = addAdminSchema.parse(input);

  const userId = member;

  // Check if the user exist
  const userExist = await prisma.user.findUnique({
    where: {
      id: member,
    },
  });

  // throw error if user is not found
  if (!userExist) {
    throw new Error("Utilisateur non trouvé");
  }

  const room = await prisma.room.findUnique({
    where: {
      id: roomId,
    },
  });

  if (!room) {
    throw new Error("La discussion n'existe pas");
  }

  if (!room.isGroup) {
    throw new Error("Cette discussion n'est pas un groupe");
  }

  // check if the user is member of the room
  const roomMember = await prisma.roomMember.findUnique({
    where: {
      roomId_userId: {
        roomId,
        userId,
      },
    },
  });
  // throw an error if user is not a member
  if (!roomMember) {
    throw new Error("L'utilisateur n'est plus membre de cette discussion");
  }

  // check if member type is not OLD or BANNED
  if (roomMember.type === "OLD" || roomMember.type === "BANNED") {
    throw new Error(
      "Cet utilisateur ne fais plus parti de cette discussion ou e été banni",
    );
  }
  // name admin by changing the type between ADMIN & MEMBER
  const newRoomMember = await prisma.roomMember.update({
    where: {
      roomId_userId: {
        roomId,
        userId,
      },
    },
    data: {
      type: roomMember.type === "ADMIN" ? "MEMBER" : "ADMIN",
    },
  });

  return { newRoomMember };
}
export async function removeMember(input: {
  roomId: string;
  memberId: string;
}) {
  const { user } = await validateRequest();

  if (!user) {
    throw new Error("Action non autorisée");
  }

  const { roomId, memberId } = memberActionSchema.parse(input);

  const userId = memberId || "";

  // Check if the user exist
  const userExist = await prisma.user.findUnique({
    where: {
      id: memberId,
    },
  });

  // throw error if user is not found
  if (!userExist) {
    throw new Error("Utilisateur non trouvé");
  }

  const room = await prisma.room.findUnique({
    where: {
      id: roomId,
    },
  });

  if (!room) {
    throw new Error("La discussion n'existe pas");
  }

  if (!room.isGroup) {
    throw new Error("Cette discussion n'est pas un groupe");
  }

  // check if the user is member of the room
  const roomMember = await prisma.roomMember.findUnique({
    where: {
      roomId_userId: {
        roomId,
        userId,
      },
    },
  });
  // throw an error if user is not a member
  if (!roomMember) {
    throw new Error("L'utilisateur n'est plus membre de cette discussion");
  }

  // check if member type is not OLD or BANNED
  if (roomMember.type === "OLD" || roomMember.type === "BANNED") {
    throw new Error(
      "Cet utilisateur ne fais plus parti de cette discussion ou e été banni",
    );
  }
  // name admin by changing the type between ADMIN & MEMBER
  const oldMember = await prisma.roomMember.update({
    where: {
      roomId_userId: {
        roomId,
        userId,
      },
    },
    data: {
      type: "OLD",
      leftAt: new Date(),
    },
  });
  if (!oldMember) {
    throw new Error("Erreur lors de la suppression du membre");
  }
  // Send a message
  const removeMsg = await prisma.message.create({
    data: {
      content: "leave",
      roomId,
      type: "LEAVE",
      senderId: user.id,
      recipientId: memberId,
    },
  });

  if (!removeMsg) {
    throw new Error("Erreur lors de la suppression du membre");
  }
  const lastMessage = await prisma.lastMessage.findFirst({
    where: {
      userId,
      roomId,
    },
  });
  if (lastMessage) {
    await prisma.lastMessage.update({
      where: {
        userId_roomId: {
          userId,
          roomId,
        }
      },
      data: {
        messageId: removeMsg.id,
        createdAt: new Date(),
      },
    });
  } else {
    await prisma.lastMessage.create({
      data: {
        userId,
        roomId,
        messageId: removeMsg.id,
      },
    });
  }
}
export async function banMember(input: {
  roomId: string;
  memberId: string;
}) {
  const { user } = await validateRequest();

  if (!user) {
    throw new Error("Action non autorisée");
  }

  const { roomId, memberId } = memberActionSchema.parse(input);

  const userId = memberId || "";

  // Check if the user exist
  const userExist = await prisma.user.findUnique({
    where: {
      id: memberId,
    },
  });

  // throw error if user is not found
  if (!userExist) {
    throw new Error("Utilisateur non trouvé");
  }

  const room = await prisma.room.findUnique({
    where: {
      id: roomId,
    },
  });

  if (!room) {
    throw new Error("La discussion n'existe pas");
  }

  if (!room.isGroup) {
    throw new Error("Cette discussion n'est pas un groupe");
  }

  // check if the user is member of the room
  const roomMember = await prisma.roomMember.findUnique({
    where: {
      roomId_userId: {
        roomId,
        userId,
      },
    },
  });
  // throw an error if user is not a member
  if (!roomMember) {
    throw new Error("L'utilisateur n'est plus membre de cette discussion");
  }

  // check if member type is not OLD or BANNED
  if (roomMember.type === "OLD" || roomMember.type === "BANNED") {
    throw new Error(
      "Cet utilisateur ne fais plus parti de cette discussion ou e été banni",
    );
  }
  // ban the member
  const bannedMember = await prisma.roomMember.update({
    where: {
      roomId_userId: {
        roomId,
        userId,
      },
    },
    data: {
      type: "BANNED",
      leftAt: new Date(),
    },
  });
  if (!bannedMember) {
    throw new Error("L'utilisateur n'a pas été banni");
  }
  // Send a message
  const banMsg = await prisma.message.create({
    data: {
      content: "ban",
      roomId,
      type: "BAN",
      senderId: user.id,
      recipientId: memberId,
    },
  });

  if (!banMsg) {
    throw new Error("Le message de bannissement n'a pas été envoyé");
  }
}

export async function leaveGroup(input: {
  roomId: string;
  deleteGroup: boolean;
}) {
  const { user } = await validateRequest();

  if (!user) {
    throw new Error("Action non autorisée");
  }

  const { roomId, deleteGroup } = memberActionSchema.parse(input);
  const userId = user.id;

  // Vérifier si le canal existe et que c'est bien un groupe
  const room = await prisma.room.findUnique({
    where: {
      id: roomId,
    },
    include: {
      members: true, // Inclure les membres du canal pour vérifier le statut
    },
  });

  if (!room) {
    throw new Error("Le groupe n'existe pas");
  }

  if (!room.isGroup) {
    throw new Error("Cette discussion n'est pas un groupe");
  }

  // Vérifier si l'utilisateur est membre du groupe
  const roomMember = await prisma.roomMember.findUnique({
    where: {
      roomId_userId: {
        roomId,
        userId,
      },
    },
  });

  if (!roomMember) {
    throw new Error("Vous n'êtes plus membre de ce groupe");
  }

  // Si l'utilisateur est le propriétaire du groupe
  if (roomMember.type === "OWNER") {
    // Vérifier combien de membres sont encore dans le groupe
    const remainingMembers = room.members.filter(
      (member) => member.type !== "OLD" && member.type !== "BANNED",
    );

    // Si l'utilisateur est le seul membre restant
    if (remainingMembers.length === 1) {
      // Supprimer le groupe automatiquement
      await prisma.room.delete({
        where: {
          id: roomId,
        },
      });
      return {
        message:
          "Le groupe a été supprimé car il n'y avait plus qu'un seul membre.",
      };
    }

    if (deleteGroup) {
      // Supprimer le groupe si l'utilisateur choisit cette option
      await prisma.room.delete({
        where: {
          id: roomId,
        },
      });
      return { message: "Le groupe a été supprimé avec succès." };
    } else {
      // Nommer le membre le plus ancien comme propriétaire
      const nextOwner = remainingMembers
        .filter((member) => member.userId !== userId)
        .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0];

      if (!nextOwner) {
        throw new Error("Aucun autre membre à nommer comme propriétaire.");
      }

      // Mettre à jour le type du nouveau propriétaire
      await prisma.roomMember.update({
        where: {
          roomId_userId: {
            roomId,
            userId: nextOwner.userId as string,
          },
        },
        data: {
          type: "OWNER",
        },
      });
    }
  }

  // Mettre à jour l'utilisateur pour indiquer qu'il a quitté le groupe
  await prisma.roomMember.update({
    where: {
      roomId_userId: {
        roomId,
        userId,
      },
    },
    data: {
      type: "OLD",
      leftAt: new Date(),
    },
  });

  // Envoyer un message dans le groupe pour notifier le départ
  await prisma.message.create({
    data: {
      content: "leave",
      roomId,
      type: "LEAVE",
      recipientId: userId,
    },
  });

  return { message: "Vous avez quitté le groupe avec succès." };
}

export async function restoreMember(input: {
  roomId: string;
  memberId: string;
}) {
  const { user } = await validateRequest();

  if (!user) {
    throw new Error("Action non autorisée");
  }

  const { roomId, memberId } = memberActionSchema.parse(input);

  const userId = memberId || "";

  // Check if the user exist
  const userExist = await prisma.user.findUnique({
    where: {
      id: memberId,
    },
  });

  // throw error if user is not found
  if (!userExist) {
    throw new Error("Utilisateur non trouvé");
  }

  const room = await prisma.room.findUnique({
    where: {
      id: roomId,
    },
  });

  if (!room) {
    throw new Error("La discussion n'existe pas");
  }

  if (!room.isGroup) {
    throw new Error("Cette discussion n'est pas un groupe");
  }

  // check if the user is member of the room
  const roomMember = await prisma.roomMember.findUnique({
    where: {
      roomId_userId: {
        roomId,
        userId,
      },
    },
  });
  // throw an error if user is not a member
  if (!roomMember) {
    throw new Error("L'utilisateur n'est plus membre de cette discussion");
  }

  // Restore member
  const newRoomMember = await prisma.roomMember.update({
    where: {
      roomId_userId: {
        roomId,
        userId,
      },
    },
    data: {
      type: "MEMBER",
      leftAt: null,
    },
  });
  if (!newRoomMember) {
    throw new Error("Erreur lors de la mise à jour du membre");
  }
  await prisma.message.create({
    data: {
      content: "add-" + userId,
      senderId: user.id,
      recipientId: userId,
      type: "NEWMEMBER",
      roomId,
    },
    include: getMessageDataInclude(user.id),
  });
}
export async function saveMessage(input: {}) {
  const { user: loggedInUser } = await validateRequest();

  if (!loggedInUser) {
    throw new Error("Action non autorisée");
  }

  const user = await prisma.user.findFirst({
    where: {
      id: loggedInUser.id,
    },
    select: getUserDataSelect(loggedInUser.id),
  });

  if (!user) {
    throw new Error("Action non autorisée");
  }

  const userId = user.id;

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

    const newRoom: RoomData = {
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
          joinedAt: loggedInUser.createdAt,
          leftAt: null,
        },
      ],
      maxMembers: 300,
      messages: [existingSavedMsg],
      isGroup: false,
      createdAt: createInfo?.createdAt || new Date(),
    };
    return { newRoom, userId };
  }

  const createInfo: MessageData = await prisma.message.create({
    data: {
      content: `create-${user.id}`,
      senderId: userId,
      type: "SAVED",
    },
    include: getMessageDataInclude(user.id),
  });

  const newMessage: MessageData = {
    id: createInfo.id,
    content: createInfo.content,
    senderId: userId,
    sender: createInfo.sender,
    recipientId: userId,
    reactionId: null,
    recipient: user,
    type: "CREATE",
    roomId: userId,
    createdAt: createInfo.createdAt,
    _count: {
      reactions: 0,
    },
    reactions: [],
  };

  const newRoom: RoomData = {
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
        joinedAt: loggedInUser.createdAt,
        leftAt: null,
      },
    ],
    maxMembers: 300,
    messages: [newMessage],
    isGroup: false,
    createdAt: createInfo.createdAt,
  };

  if (!createInfo) {
    throw new Error("Impossible de créer le message de création du canal");
  }
  return { newRoom, userId, createInfo: newMessage };
}
