"use server";

import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import {
  getMessageDataInclude,
  getUserDataSelect,
  MessageData,
} from "@/lib/types";
import {
  addAdminSchema,
  addMemberSchema,
  memberActionSchema,
} from "@/lib/validation";


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
