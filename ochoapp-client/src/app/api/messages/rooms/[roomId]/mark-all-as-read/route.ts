import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";

export async function POST(
  req: Request,
  {
    params,
  }: {
    params: Promise<{ roomId: string }>;
  },
) {
  const {roomId} = await params
  try {
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    //   Get all messages
    const messages = await prisma.message.findMany({
      where: { roomId },
    });

    if (!messages) {
      return Response.json(
        { error: "Impossible de recuperer les messages" },
        { status: 404 },
      );
    }

    await Promise.all(
      messages.map((message) => {
        const messageId = message.id,
          userId = loggedInUser.id;
        return prisma.read.upsert({
          where: {
            userId_messageId: {
              userId,
              messageId,
            },
          },
          create: {
            userId,
            messageId,
          },
          update: {},
        });
      }),
    );

    return new Response();
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
