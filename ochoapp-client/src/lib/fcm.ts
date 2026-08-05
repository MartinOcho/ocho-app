import { cert, getApps, initializeApp, ServiceAccount } from "firebase-admin/app";
import { getMessaging, MulticastMessage } from "firebase-admin/messaging";
import prisma from "./prisma";

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

/**
 * Envoie une notification push à un utilisateur via FCM
 */
export async function sendPushNotification(
  userId: string,
  payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }
) {
  try {
    const fcmTokens = await prisma.fCMToken.findMany({
      where: { userId },
      select: { token: true },
    });

    if (fcmTokens.length === 0) return;

    const tokens = fcmTokens.map((t) => t.token);
    const messaging = getMessaging();

    const message: MulticastMessage = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      tokens,
    };

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
