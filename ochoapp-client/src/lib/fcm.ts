import { cert, getApps, initializeApp, ServiceAccount } from "firebase-admin/app";
import { getMessaging, MulticastMessage } from "firebase-admin/messaging";
import prisma from "./prisma";
import { NotificationData } from "./types";

// Initialiser Firebase Admin (s'il n'est pas déjà initialisé)
if (!getApps().length) {
  try {
    const serviceAccountKey: ServiceAccount | null =
      process.env.FCM_PROJECT_ID && process.env.FCM_PRIVATE_KEY && process.env.FCM_CLIENT_EMAIL
      ? {
          projectId: process.env.FCM_PROJECT_ID,
          privateKey: process.env.FCM_PRIVATE_KEY.replace(/\\n/g, "\n"),
          clientEmail: process.env.FCM_CLIENT_EMAIL,
        }
      : null;

    if (serviceAccountKey) {
      initializeApp({
        credential: cert(serviceAccountKey),
      });
      console.log("[FCM] Firebase Admin initialisé");
    }
  } catch (error) {
    console.error("[FCM] Erreur lors de l'initialisation de Firebase Admin:", error);
  }
}


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


/**
 * Envoie une notification push à un utilisateur via FCM (Format compatible avec le serveur OchoApp)
 */
export async function sendPushNotification(
  userId: string,
  payload: FCMNotificationPayload
) {
  try {
    const fcmTokens = await prisma.fCMToken.findMany({
      where: { userId },
      select: { token: true },
    });

    if (fcmTokens.length === 0) return;

    const tokens = fcmTokens.map((t) => t.token);
    const messaging = getMessaging();

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

    const response = await messaging.sendEachForMulticast(message);

    // Gérer les tokens invalides
    const failedTokens: string[] = [];
    response.responses.forEach((resp, index) => {
      if (!resp.success) {
        if (resp.error?.code === 'messaging/invalid-registration-token' ||
            resp.error?.code === 'messaging/registration-token-not-registered') {
          failedTokens.push(tokens[index]);
        }
      }
    });

    if (failedTokens.length > 0) {
      await prisma.fCMToken.deleteMany({
        where: { token: { in: failedTokens } },
      });
    }
  } catch (error) {
    console.error("[FCM] Erreur lors de l'envoi de la notification:", error);
  }
}
