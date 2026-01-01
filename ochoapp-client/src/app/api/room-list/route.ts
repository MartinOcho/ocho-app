import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import {
  RoomsSection,
  getChatRoomDataInclude,
  RoomData,
  getMessageDataInclude,
  MessageData,
} from "@/lib/types";
import { createRoomSchema } from "@/lib/validation";
import { NextRequest } from "next/server";
import { getUserDataSelect } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
    const pageSize = 10;

    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    const user = await prisma.user.findFirst({
      where: {
        id: loggedInUser.id,
      },
      select: getUserDataSelect(loggedInUser.id, loggedInUser.username),
    });

    if (!user) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    const lastMessages = await prisma.lastMessage.findMany({
      where: {
        userId: user.id,
      },
      select: {
        roomId: true,
        messageId: true,
        message: {
          include: getMessageDataInclude(loggedInUser.id),
        },
        room: {
          include: getChatRoomDataInclude(),
        },
      },
      orderBy: {
        createdAt: "desc"
      },
      take: pageSize + 1, // Récupérer une page supplémentaire pour déterminer s'il y a une page suivante
      cursor: cursor ? { 
        userId_roomId: { userId: user.id, roomId: cursor }
      } : undefined,
    });
     

    // Récupérer les canaux dans lesquels l'utilisateur est membre avec leur dernier message
    const rooms = lastMessages.map((lastMessage) => {
      const lastMsg: MessageData | null = lastMessage.message;
        const room: RoomData | null = lastMessage.room;
        if (!room) return {
          id: "",
          name: null,
          description: null,
          groupAvatarUrl: null,
          privilege: "DEFAULT",
          members: [
            {
            user,
            userId: user.id,
            type: "MEMBER",
            joinedAt: user.createdAt,
            leftAt: null,
          },
          ],
          maxMembers: 1,
          messages: lastMsg ? [lastMsg] : [],
          isGroup: false,
          createdAt: new Date(0),

        } as RoomData;

        return {
          ...room,
          messages: lastMsg ? [lastMsg] : [],
        } as RoomData;
    })
    const updatedRooms: RoomData[] = rooms



    // Récupérer également les messages envoyés à soi-même sans canal
    const selfMessage: MessageData | null = await prisma.message.findFirst({
      where: {
        senderId: user.id,
        type: "SAVED", // Type de message sauvegardé
      },
      include: getMessageDataInclude(loggedInUser.id),
      orderBy: { createdAt: "desc" },
    });

    // Ajouter les messages envoyés à soi-même aux canaux
    if (selfMessage) {
      if (selfMessage.content !== `create-${user.id}`) {
        selfMessage.type = "CONTENT";
      }
      const selfRoom: RoomData | null = {
        id: `saved-${user.id}`,
        name: null,
        description: null,
        groupAvatarUrl: null,
        privilege: "MANAGE",
        members: [
          {
            user,
            userId: user.id,
            type: "OWNER",
            joinedAt: user.createdAt,
            leftAt: null,
          },
        ],
        maxMembers: 1,
        messages: [selfMessage],
        isGroup: false,
        createdAt: selfMessage.createdAt,
      };
      if (selfRoom) {
        updatedRooms.unshift(selfRoom); // Ajouter ce canal fictif au début de la liste
      }
    }

    const nextCursor =
      rooms.length > pageSize ? rooms[pageSize].id : null;

    const data: RoomsSection = {
      rooms: updatedRooms.slice(0, pageSize),
      nextCursor,
    };

    return Response.json(data);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Erreur interne du serveur" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    // Validation de l'utilisateur connecté
    const { user } = await validateRequest();
    if (!user) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    // Lecture et parsing du body de la requête
    const body = await req.json();
    const parsed = createRoomSchema.parse(body);

    // Assurer que l'utilisateur connecté est dans les membres du canal
    let members = parsed.members ? [...parsed.members, user.id] : [user.id];

    // Supprimer les doublons dans la liste des membres
    members = [...new Set(members)];

    // Validation pour les groupes : au moins deux membres (l'utilisateur connecté + 1 autre)
    if (parsed.isGroup && members.length < 2) {
      return Response.json(
        { error: "Un groupe doit avoir au moins deux membres" },
        { status: 400 },
      );
    }

    // Vérifier si une discussion individuelle (non groupe) avec ces deux membres existe déjà
    if (!parsed.isGroup) {
      const existingRoom = await prisma.room.findFirst({
        where: {
          isGroup: false,
          AND: [
            { members: { some: { userId: members[0] } } },
            { members: { some: { userId: members[1] } } },
          ],
        },
        include: getChatRoomDataInclude(),
      });

      // Si un canal existe déjà, le renvoyer directement
      if (existingRoom) {
        return Response.json(existingRoom);
      }
    }

    // Si le canal n'existe pas, le créer
    const room = await prisma.room.create({
      data: {
        name: parsed.name,
        isGroup: parsed.isGroup,
        members: {
          create: members.map((memberId) => ({
            userId: memberId,
          })),
        },
      },
      include: getChatRoomDataInclude(), // Inclure les données requises
    });

    await prisma.message.create({
      data: {
        content: "created",
        roomId: room.id,
        senderId: room.isGroup ? user.id : null,
        type: "CREATE",
      },
    });

    return Response.json(room);
  } catch (error) {
    console.error("Erreur lors de la création de la discussion:", error);
    return Response.json(
      { error: "Impossible de créer cette discussion" },
      { status: 400 },
    );
  }
}
