import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { ReadInfo } from "@/lib/types";

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
        reads: {
          select: {
            user: {
              select: {
                id: true,
                displayName: true,
                username: true,
              },
            },
          },
        },
      },
    });

    if (!message) {
      return Response.json({ error: "Message non trouvé" }, { status: 404 });
    }

    const reads = message.reads.map((read) => read.user);

    const data: ReadInfo = {
      reads,
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
    });

    if (!message) {
      return Response.json({ error: "Message non trouvé" }, { status: 404 });
    }

    await prisma.read.upsert({
      where: {
        userId_messageId: {
          userId: loggedInUser.id,
          messageId,
        },
      },
      create: {
        userId: loggedInUser.id,
        messageId,
      },
      update: {},
    });

    return new Response();
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
