// src/app/api/notifications/identify/route.ts

import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NotificationType } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const { user: loggedInUser } = await validateRequest();
    if (!loggedInUser) {
      return Response.json({ error: "Action non autorisée", status: 401 });
    }

    const { recipientId, postId, type } = await req.json();

    // Vérifier s'il existe déjà une notification d'identification pour ce issuerId et postId
    const existingIdentification = await prisma.notification.findFirst({
      where: {
        issuerId: loggedInUser.id,
        recipientId,
        postId,
        type: NotificationType.IDENTIFY,
      },
    });

    if (existingIdentification) {
      return Response.json({ error: "Notification d'identification déjà existante", status: 400 });
    }

    // Si aucune notification n'existe, la créer
    await prisma.notification.create({
      data: {
        issuerId: loggedInUser.id,
        recipientId,
        postId,
        type: type as NotificationType,
      },
    });

    // Informer le serveur de sockets pour qu'il émette la mise à jour en temps réel
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_CHAT_SERVER_URL || "http://localhost:5000"}/internal/create-notification`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": process.env.INTERNAL_SERVER_SECRET || "",
          },
          body: JSON.stringify({
            type: "IDENTIFY",
            recipientId,
            issuerId: loggedInUser.id,
            postId,
          }),
        },
      );
    } catch (e) {
      // Ne pas échouer la requête principale si l'appel de notification échoue
      console.warn("Impossible de notifier le serveur de sockets:", e);
    }

    return new Response();
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error", status: 500 });
  }
}
