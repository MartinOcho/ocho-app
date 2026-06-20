import { cert, getApps, initializeApp, ServiceAccount } from "firebase-admin/app";
import { getMessaging, MulticastMessage } from "firebase-admin/messaging";
import prisma from "./prisma";
import chalk from "chalk";
import { MessageData, NotificationData } from "./types";

// Initialiser Firebase Admin (s'il n'est pas déjà initialisé)
if (!getApps().length) {
  try {
    const keys = {
            projectId: process.env.FCM_PROJECT_ID,
            privateKey: process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, "\n"),
            clientEmail: process.env.FCM_CLIENT_EMAIL
          }
    const serviceAccountKey: ServiceAccount | null = (keys.projectId && keys.privateKey && keys.clientEmail)
      ? {
            projectId: process.env.FCM_PROJECT_ID,
            privateKey: process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, "\n"),
                clientEmail: process.env.FCM_CLIENT_EMAIL
            } : null;

    if (!serviceAccountKey) {
        console.log(chalk.redBright("Clé de service Firebase non configurée. Veuillez définir les variables d'environnement FCM_PROJECT_ID, FCM_PRIVATE_KEY et FCM_CLIENT_EMAIL."));
        console.log(keys);
        
        
      throw new Error(
        "Clé de service Firebase non configurée. Veuillez définir les variables d'environnement FCM_PROJECT_ID, FCM_PRIVATE_KEY et FCM_CLIENT_EMAIL."
      );
    }

    initializeApp({
      credential: cert(serviceAccountKey),
    });
    console.log(chalk.greenBright("[FCM] Firebase Admin initialisé"));
  } catch (error) {
    console.log(chalk.redBright("[FCM] Erreur lors de l'initialisation de Firebase Admin:"));
    console.error(error);
  }
}

const messaging = getMessaging();

export interface FCMRoomPayload {
  id: string;
  name: string | null;
  groupAvatarUrl: string | null;
  isGroup: boolean;
}

export interface FCMPersonPayload {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface FCMVoiceNotePayload {
  id: string;
  url: string;
  duration: number;
  createdAt: string;
}

export interface FCMAttachmentPayload {
  id: string;
  type: string;
  url: string;
  publicId: string | null;
  fileName: string | null;
  width: number | null;
  height: number | null;
  format: string | null;
  resourceType: string | null;
}

export interface FCMMessageData {
  id: string;
  type: string;
  content: string | null;
  createdAt: string;
  sender: FCMPersonPayload;
  recipient: FCMPersonPayload;
  room: FCMRoomPayload;
  voiceNote?: FCMVoiceNotePayload;
  attachments?: FCMAttachmentPayload[];
}

export type FCMNotificationPayload =
  | {
      type: "NOTIFICATION";
      notification: NotificationData;
      message?: undefined;
    }
  | {
      type: "MESSAGE";
      notification?: undefined;
      message: FCMMessageData;
    };

function getMinimalFCMMessage(message: MessageData, room: FCMRoomPayload): FCMMessageData {
  if (!message.sender || !message.recipient) {
    throw new Error("FCM message payload requires sender and recipient");
  }

  const fcmMessage: FCMMessageData = {
    id: message.id,
    type: message.type,
    content: message.content ?? null,
    createdAt: new Date(message.createdAt).toISOString(),
    sender: {
      id: message.sender.id,
      username: message.sender.username,
      displayName: message.sender.displayName,
      avatarUrl: message.sender.avatarUrl,
    },
    recipient: {
      id: message.recipient.id,
      username: message.recipient.username,
      displayName: message.recipient.displayName,
      avatarUrl: message.recipient.avatarUrl,
    },
    room: {
      id: room.id,
      name: room.name,
      groupAvatarUrl: room.groupAvatarUrl,
      isGroup: room.isGroup,
    },
  };

  if (message.voiceNote) {
    fcmMessage.voiceNote = {
      id: message.voiceNote.id,
      url: message.voiceNote.url,
      duration: message.voiceNote.duration,
      createdAt: new Date(message.voiceNote.createdAt).toISOString(),
    };
  }

  if (message.attachments && message.attachments.length > 0) {
    fcmMessage.attachments = message.attachments.map((attachment) => ({
      id: attachment.id,
      type: attachment.type,
      url: attachment.url,
      publicId: attachment.publicId ?? null,
      fileName: attachment.fileName ?? null,
      width: attachment.width ?? null,
      height: attachment.height ?? null,
      format: attachment.format ?? null,
      resourceType: attachment.resourceType ?? null,
    }));
  }

  return fcmMessage;
}

/**
 * Envoie une notification FCM à l'utilisateur
 */
export async function sendFCMNotification(
  userId: string,
  payload: FCMNotificationPayload
) {
  try {
    // Récupérer les tokens FCM de l'utilisateur
    const fcmTokens = await prisma.fCMToken.findMany({
      where: { userId },
      select: { token: true },
    });

    if (fcmTokens.length === 0) {
      console.log(chalk.yellowBright(`[FCM] Aucun token FCM pour l'utilisateur ${userId}`));
      return;
    }
 
    const tokens = fcmTokens.map((t) => t.token);

    // Construire le message FCM
    const message = {
      data: {
        type: payload.type,
        ...(payload.notification && {
          notification: JSON.stringify(payload.notification),
        }),
        ...(payload.message && { message: JSON.stringify(payload.message) }),
      },
      tokens,
    } as MulticastMessage;

    console.log(chalk.blueBright(`[FCM] Envoi de la notification ${JSON.stringify(message)} à l'utilisateur ${userId}`));

    // Envoyer le message multicast
    const response = await messaging.sendEachForMulticast(message);
    response.responses.forEach((resp, index) => {
      if (!resp.success) {
        console.error(chalk.redBright(`[FCM] Erreur lors de l'envoi du message à ${tokens[index]}: ${resp.error?.message}`));
      }
    });

    console.log(
      chalk.greenBright(`[FCM] ${response.successCount}/${tokens.length} messages envoyés à l'utilisateur ${userId}`)
    );

    // Gérer les tokens invalides
    const failedTokens: string[] = [];
    response.responses.forEach((resp: import('firebase-admin/messaging').SendResponse, index: number) => {
      if (!resp.success) {
        failedTokens.push(tokens[index]);
      }
    });

    // Supprimer les tokens invalides
    if (failedTokens.length) {
      await prisma.fCMToken.deleteMany({
        where: { token: { in: failedTokens } },
      });
      console.log(
        chalk.redBright(`[FCM] ${failedTokens.length} tokens invalides supprimés`)
      );
    }
  } catch (error) {
    console.warn(chalk.redBright("[FCM] Erreur lors de l'envoi de la notification:"), error);
  }
}

/**
 * Envoie une notification de message FCM
 */
export async function sendMessageNotificationFCM(
  recipientId: string,
  room: FCMRoomPayload,
  message: MessageData
) {
  await sendFCMNotification(recipientId, {
    type: "MESSAGE",
    message: getMinimalFCMMessage(message, room),
  });
}

/**
 * Envoie une notification FCM
 */
export async function sendNotificationFCM(
  recipientId: string,
  notification: NotificationData
) {
  await sendFCMNotification(recipientId, {
    type: "NOTIFICATION",
    notification,
  });
}

/**
 * Enregistre ou met à jour le token FCM d'un utilisateur
 */
export async function registerFCMToken(
  userId: string,
  token: string,
  deviceId?: string
) {
  try {
    // Vérifier si le token existe déjà
    const existingToken = await prisma.fCMToken.findUnique({
      where: { token },
    });

    if (existingToken) {
      // Mettre à jour si c'est un autre utilisateur
      if (existingToken.userId !== userId) {
        await prisma.fCMToken.update({
          where: { token },
          data: { userId, deviceId, updatedAt: new Date() },
        });
        console.log(chalk.yellowBright(`[FCM] Token ${token} mis à jour pour l'utilisateur ${userId}`));
      }
    } else {
      // Créer un nouveau token
      await prisma.fCMToken.create({
        data: { userId, token, deviceId },
      });
      console.log(chalk.greenBright(`[FCM] Token FCM enregistré pour l'utilisateur ${userId}`));
    }
  } catch (error) {
    console.error(chalk.redBright("[FCM] Erreur lors de l'enregistrement du token FCM:"), error);
    throw error;
  }
}

/**
 * Supprime un token FCM
 */
export async function removeFCMToken(token: string) {
  try {
    await prisma.fCMToken.delete({
      where: { token },
    });
    console.log(chalk.greenBright(`[FCM] Token FCM ${token} supprimé`));
  } catch (error) {
    console.error(chalk.redBright("[FCM] Erreur lors de la suppression du token FCM:"), error);
  }
}
