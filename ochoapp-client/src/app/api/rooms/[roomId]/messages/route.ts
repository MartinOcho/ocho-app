import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import {
  getMessageDataInclude,
  MessageData,
  MessagesSection,
} from "@/lib/types";

export async function GET(
  req: Request,
  {
    params,
  }: {
    params: Promise<{ roomId: string }>;
  },
) {
  const { roomId } = await params;

  try {
    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor") || undefined;
    const pageSize = 10;

    const { user } = await validateRequest();

    if (!user) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    // Vérifier si on récupère des messages sauvegardés
    const isSavedMessages = roomId === `saved-${user.id}`;

    let messages: MessageData[] = [];
    let nextCursor: string | null = null;

    if (isSavedMessages) {
      // --- LOGIQUE MESSAGES SAUVEGARDÉS ---
      messages = await prisma.message.findMany({
        where: {
          senderId: user.id,
          type: "SAVED",
        },
        include: getMessageDataInclude(user.id),
        // CORRECTION MAJEURE: Ajout de l'ID pour un tri stable
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" } 
        ],
        take: pageSize + 1,
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : 0,
      });

      // Transformation des types pour l'affichage
      if (messages.length > 0) {
        messages = messages.map((m) => {
          if (m.content !== `create-${user.id}`) {
            m.type = "CONTENT";
          }
          return m;
        });
      }

    } else {     
      // 1. Récupérer les infos de la room
      const roomData = await prisma.room.findUnique({
        where: { id: roomId },
        select: { isGroup: true }, // On optimise en ne sélectionnant que le nécessaire
      });

      if (!roomData) {
        return Response.json(
          { error: "Le canal n'existe pas" },
          { status: 404 },
        );
      }

      // 2. SÉCURITÉ & LOGIQUE MEMBRE (Unifiée pour Groupes et DMs)
      // On vérifie TOUJOURS si l'utilisateur est membre, même pour un DM.
      // Cela empêche un utilisateur de lire les messages d'un DM dont il ne fait pas partie.
      const member = await prisma.roomMember.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId: user.id,
          },
        },
      });

      if (!member) {
        return Response.json(
          { error: "Vous n'êtes pas membre de cette conversation" },
          { status: 403 },
        );
      }

      // Gestion spécifique aux groupes (Banni / Date de départ)
      const isGroup = roomData.isGroup;
      if (isGroup) {
        if (member.type === "BANNED") {
          return Response.json(
            { error: "Vous avez été suspendu de ce groupe" },
            { status: 403 },
          );
        }
      }

      // 3. Récupération des messages
      const whereClause: any = { roomId };
      
      
      if (isGroup && member.leftAt) {
        whereClause.createdAt = {
          lt: member.leftAt
        };
      }

      messages = await prisma.message.findMany({
        where: whereClause,
        include: getMessageDataInclude(user.id),
        // CORRECTION MAJEURE: Tri stable sur deux colonnes
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" }
        ],
        take: pageSize + 1,
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : 0,
      });
    }

    // Calcul du curseur suivant
    if (messages.length > pageSize) {
      const nextItem = messages.pop();
      nextCursor = nextItem ? nextItem.id : null;
    }

    const data: MessagesSection = {
      messages,
      nextCursor,
    };

    return Response.json(data);

  } catch (error) {
    console.error("Erreur lors de la récupération des messages:", error);
    return Response.json(
      { error: "Erreur interne du serveur" },
      { status: 500 },
    );
  }
}