"use server";

import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import fs from "fs";
import path from "path";
import { UTApi, UTFile } from "uploadthing/server";
import {
  getChatRoomDataInclude,
  getUserDataSelect,
  LocalUpload,
} from "@/lib/types";
import {
  updateGroupChatProfileSchema,
  UpdateGroupChatProfileValues,
  updateUserProfileSchema,
  UpdateUserProfileValues,
} from "@/lib/validation";
import { v4 as uuidv4 } from "uuid";
import { MemberType } from "@prisma/client";

export async function updateUserProfile(
  values: UpdateUserProfileValues & { avatarUrl?: string },
) {
  const validatedValues = updateUserProfileSchema.parse(values);

  const { user } = await validateRequest();

  if (!user) {
    throw new Error("Action non autorisée");
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...validatedValues,
      avatarUrl: values.avatarUrl,
    },
    select: getUserDataSelect(user.id),
  });

  return updatedUser;
}
export async function deleteUserAvatar() {
  const { user } = await validateRequest();

  if (!user) {
    throw new Error("Action non autorisée");
  }
  let filePath: string;
  const avatarDir = path.resolve("data/uploads/avatars");

  if (user.avatarUrl?.includes("/uploads/avatars/")) {
    // If it's an attachment
    filePath = path.join(
      avatarDir,
      user.avatarUrl.split("/uploads/avatars/")[1],
    );
  } else {
    const key = user.avatarUrl?.split(
      `/a/${process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID}/`,
    )[1];
    if (!key) {
      throw new Error("Fichier introuvable");
    }
    new UTApi().deleteFiles(key);
    return;
  }

  // Supprimer le fichier s'il existe
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      avatarUrl: null,
    },
    select: getUserDataSelect(user.id),
  });

  return updatedUser;
}

export async function updateGroupChatProfile(
  values: UpdateGroupChatProfileValues & {
    groupAvatarUrl?: string;
  },
) {
  const validatedValues = updateGroupChatProfileSchema.parse(values);

  const { user } = await validateRequest();

  if (!user) {
    throw new Error("Action non autorisée");
  }

  const room = await prisma.room.findUnique({
    where: { id: values.id },
    include: getChatRoomDataInclude(),
  });

  if (!room) {
    throw new Error("Groupe introuvable");
  }

  if (!room.isGroup) {
    throw new Error("Groupe introuvable");
  }

  const loggedMember = room.members.find(
    (member) => member.userId === user.id,
  );

  if (!loggedMember) {
    throw new Error("Vous n'êtes plus membre de ce groupe");
  }

  const admins: MemberType[] = ["ADMIN", "OWNER"];

  if (!admins.includes(loggedMember.type)) {
    throw new Error(
      "Cette action ne peut être que effectuée par un administrateur",
    );
  }

  const updatedGroup = await prisma.room.update({
    where: { id: values.id },
    data: {
      ...validatedValues,
      groupAvatarUrl: values.groupAvatarUrl,
    },
    select: {
      id: true,
      name: true,
      description: true,
      groupAvatarUrl: true,
      isGroup: true,
    },
  });

  return updatedGroup;
}

export async function uploadGroupAvatarFile({
  file,
  roomId,
}: {
  file: File | null;
  roomId: string;
}) {
  const { user } = await validateRequest();

  const uploadDir = path.resolve("data/uploads/avatars");

  if (!user) {
    throw new Error("Action non autorisée");
  }
  try {
    if (!file) {
      throw new Error("No file uploaded");
    }

    if (!roomId) {
      throw new Error("Données invalides");
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: getChatRoomDataInclude(),
    });

    if (!room) {
      throw new Error("Groupe introuvable");
    }

    if (!room.isGroup) {
      throw new Error("Ce canal de discussion n'est pas un groupe");
    }

    const loggedMember = room.members.find(
      (member) => member.userId === user.id,
    );

    if (!loggedMember) {
      throw new Error("Vous n'êtes pas membre de ce groupe");
    }

    const admins: MemberType[] = ["ADMIN", "OWNER"];

    if (!admins.includes(loggedMember.type)) {
      throw new Error("Vous n'avez pas les droits pour effectuer cette action");
    }

    const filename = `${uuidv4()}_${file.name}`;
    const filepath = path.join(uploadDir, filename);

    // Assurer que le répertoire de téléchargement existe
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Retourner l'URL relative pour accéder au fichier
    let url = `/api/uploads/avatars/${filename}`;

    // Enregistrer le fichier localement
    const buffer = Buffer.from(await file.arrayBuffer());
    // await fs.promises.writeFile(filepath, buffer).catch(async (err) => {
    // });
    const utapi = new UTApi();

    const utFile = new UTFile(["group-chat-avatar"], file.name);
    const utResponse = await utapi.uploadFiles([utFile]);
    if (!utResponse?.[0].data?.url) {
      throw new Error("Url introuvable");
    }
    if (utResponse[0].error) {
      throw new Error("Erreur lors de l'enregistrement du fichier");
    }
    const addAppUrl = !utResponse[0].data.url
      .split("https://")[1]
      .startsWith(process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID || "");
    url = addAppUrl ?utResponse[0].data.url.replace(
      "/f/",
      `/a/${process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID}/`,
    ) : utResponse[0].data.url;
    const name = filename;
    const appUrl = url;
    const size = file.size;
    const type = "image/webp";

    // Suppression de l'ancien avatar
    const oldAvatarUrl = room.groupAvatarUrl;
    if (oldAvatarUrl) {
      const isOnLocalServer = oldAvatarUrl.startsWith("/api/uploads/avatars/");
      if (isOnLocalServer) {
        const oldFilePath = path.join(
          uploadDir,
          oldAvatarUrl.split("/uploads/avatars/")[1],
        );

        if (fs.existsSync(oldFilePath)) {
          try {
            fs.unlinkSync(oldFilePath);
          } catch (err) {
            console.error(
              "Erreur lors de la suppression de l'ancien avatar:",
              err,
            );
          }
        }
      } else {
        const key = oldAvatarUrl.split(
          `/a/${process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID}/`,
        )[1];
        await new UTApi().deleteFiles(key).catch((err) => {
          console.error(
            "Erreur lors de la suppression du fichier distant:",
            err,
          );
        });
      }
    }

    // Mettre à jour l'URL de l'avatar dans la base de données
    await prisma.room
      .update({
        where: { id: roomId },
        data: { groupAvatarUrl: url },
      })
      .catch((err) => {
        console.error(
          "Erreur lors de la mise à jour de l'avatar dans la base de données:",
          err,
        );
        throw new Error("Erreur lors de la mise à jour de l'avatar");
      });

    const fileData: LocalUpload[] = [
      {
        url,
        name,
        appUrl,
        size,
        type,
        serverData: {
          avatarUrl: url,
        },
      },
    ];

    return fileData;
  } catch (error) {
    console.error(error);
    throw new Error("Erreur de téléchargement de l'image");
  }
}

export async function deleteGroupChatAvatar({
  roomId,
}: {
  roomId: string;
}) {
  const { user } = await validateRequest();

  if (!user) {
    throw new Error("Action non autorisée");
  }

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: getChatRoomDataInclude(),
  });

  if (!room) {
    throw new Error("Groupe introuvable");
  }

  if (!room.isGroup) {
    throw new Error("Groupe introuvable");
  }

  const loggedMember = room.members.find(
    (member) => member.userId === user.id,
  );

  if (!loggedMember) {
    throw new Error("Vous n'êtes plus membre de ce groupe");
  }

  const admins: MemberType[] = ["ADMIN", "OWNER"];

  if (!admins.includes(loggedMember.type)) {
    throw new Error(
      "Cette action ne peut être que effectuée par un administrateur",
    );
  }
  let filePath: string;
  const avatarDir = path.resolve("data/uploads/avatars");

  if (room.groupAvatarUrl?.includes("/uploads/avatars/")) {
    // If it's an attachment
    filePath = path.join(
      avatarDir,
      room.groupAvatarUrl.split("/uploads/avatars/")[1],
    );
  } else {
    const key = room.groupAvatarUrl?.split(
      `/a/${process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID}/`,
    )[1];
    if (!key) {
      throw new Error("Fichier introuvable");
    }
    try {
      new UTApi().deleteFiles(key);
    } catch (error) {
      console.log(error);
    }
    return;
  }

  // Supprimer le fichier s'il existe
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  const updatedGroup = await prisma.room.update({
    where: { id: roomId },
    data: {
      groupAvatarUrl: null,
    },
    select: {
      id: true,
      name: true,
      description: true,
      groupAvatarUrl: true,
      isGroup: true,
    },
  });

  return updatedGroup;
}
