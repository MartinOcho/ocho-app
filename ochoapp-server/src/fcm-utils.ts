import admin from "firebase-admin";
import prisma from "./prisma";
import chalk from "chalk";

// Initialiser Firebase Admin (s'il n'est pas déjà initialisé)
if (!admin.apps.length) {
  try {
    const serviceAccountKey : admin.ServiceAccount | null = process.env.FCM_PRIVATE_KEY_ID && process.env.FCM_CLIENT_EMAIL
      ? {
            projectId: process.env.FCM_PROJECT_ID,
            privateKey: process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, "\n"),
            clientEmail: process.env.FCM_CLIENT_EMAIL
          } : null;

    if (!serviceAccountKey) {
        console.log(chalk.redBright("Clé de service Firebase non configurée. Veuillez définir les variables d'environnement FCM_PROJECT_ID, FCM_PRIVATE_KEY et FCM_CLIENT_EMAIL."));
        
      throw new Error(
        "Clé de service Firebase non configurée. Veuillez définir les variables d'environnement FCM_PROJECT_ID, FCM_PRIVATE_KEY et FCM_CLIENT_EMAIL."
      );
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountKey),
    });
    console.log(chalk.greenBright("[FCM] Firebase Admin initialisé"));
  } catch (error) {
    console.log(chalk.redBright("[FCM] Erreur lors de l'initialisation de Firebase Admin:"));
    console.error(error);
  }
}

const messaging = admin.messaging();

export interface FCMNotificationPayload {
  type: "NOTIFICATION" | "MESSAGE";
  notification?: any;
  room?: any;
  message?: any;
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
        ...(payload.room && { room: JSON.stringify(payload.room) }),
        ...(payload.message && { message: JSON.stringify(payload.message) }),
      },
      tokens,
    };

    // Envoyer le message multicast
    const response = await messaging.sendMulticast(message as any);

    console.log(
      chalk.greenBright(`[FCM] ${response.successCount}/${tokens.length} messages envoyés à l'utilisateur ${userId}`)
    );

    // Gérer les tokens invalides
    const failedTokens: string[] = [];
    response.responses.forEach((resp, index) => {
      if (!resp.success) {
        failedTokens.push(tokens[index]);
      }
    });

    // Supprimer les tokens invalides
    if (failedTokens.length > 0) {
      await prisma.fCMToken.deleteMany({
        where: { token: { in: failedTokens } },
      });
      console.log(
        chalk.redBright(`[FCM] ${failedTokens.length} tokens invalides supprimés`)
      );
    }
  } catch (error) {
    console.error(chalk.redBright("[FCM] Erreur lors de l'envoi de la notification:"), error);
  }
}

/**
 * Envoie une notification de message FCM
 */
export async function sendMessageNotificationFCM(
  recipientId: string,
  room: any,
  message: any
) {
  await sendFCMNotification(recipientId, {
    type: "MESSAGE",
    room,
    message,
  });
}

/**
 * Envoie une notification FCM
 */
export async function sendNotificationFCM(
  recipientId: string,
  notification: any
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
