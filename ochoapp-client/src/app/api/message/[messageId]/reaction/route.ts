import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { ReactionInfo } from "@/lib/types";

export async function GET(
  req: Request,
    { params }: { params: Promise<{ messageId: string }> },
) {
  const {messageId} = await params
  try {
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        reactions: {
          where: {
            userId: loggedInUser.id,
          },
          select: {
            userId: true,
            content: true,
          },
        },
        _count: {
          select: {
            reactions: true,
          },
        },
      },
    });

    if (!message) {
      return Response.json({ error: "Message non trouvé" }, { status: 404 });
    }

    const data: ReactionInfo = {
      reactions: message._count.reactions,
      hasUserReacted: !!message.reactions.length,
      content: message.reactions[0].content || undefined,
    };
    return Response.json(data);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
   { params }: { params: Promise<{ messageId: string }> },
) {
  const {messageId} = await params
  try {
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        senderId: true,
        roomId: true,
      },
    });

    if (!message) {
      return Response.json({ error: "Message non trouvé" }, { status: 404 });
    }

    // Extraction des données du corps de la requête
    const body = await req.json(); // Le JSON envoyé depuis le frontend
    const { content } = body; // Extraction de `content`

    if (!content) {
      return Response.json({ error: "Le contenu est requis" }, { status: 400 });
    }
    

    const emoji = content.trim()
    
    const reaction = await prisma.reaction.upsert({
      where: {
        userId_messageId: {
          userId: loggedInUser.id,
          messageId,
        },
      },
      create: {
        userId: loggedInUser.id,
        messageId,
        content: emoji,
      },
      update: {},
      select: {
        id: true,
      },
    });
    loggedInUser.id !== message.senderId &&
      (await prisma.message.create({
        data: {
          senderId: loggedInUser.id,
          recipientId: message.senderId,
          type: "REACTION",
          content: emoji,
          roomId: message.roomId,
          reactionId: reaction.id,
        },
      }));

    return Response.json({emoji});
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const {messageId} = await params
  try {
    const { user: loggedInUser } = await validateRequest();
    if (!loggedInUser) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        senderId: true,
        roomId: true,
        reactions: {
          select: {
            id: true,
          },
          where: {
            userId: loggedInUser.id,
          },
        },
      },
    });

    if (!message) {
      return Response.json({ error: "Post non trouvé" }, { status: 404 });
    }

    if (!message.reactions[0]) {
      return Response.json(
        { error: "Vous n'avez pas réagi à ce message" },
        { status: 400 },
      );
    }

    await prisma.$transaction([
      prisma.reaction.deleteMany({
        where: {
          userId: loggedInUser.id,
          messageId,
        },
      }),
      prisma.message.deleteMany({
        where: {
          senderId: loggedInUser.id,
          recipientId: message.senderId,
          roomId: message.roomId,
          reactionId: message.reactions[0].id,
          type: "REACTION",
        },
      }),
    ]);

    return new Response();
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
