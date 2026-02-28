// src/app/api/notifications/identify/route.ts

import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NotificationType } from "@prisma/client";
import kyInstance from "@/lib/ky";

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

    return new Response();
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error", status: 500 });
  }
}
