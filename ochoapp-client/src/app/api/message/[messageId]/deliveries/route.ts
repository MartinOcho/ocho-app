import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { DeliveryInfo } from "@/lib/types";

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
        deliveries: {
          select: {
            user: {
              select: {
                id: true,
                displayName: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!message) {
      return Response.json({ error: "Message non trouvé" }, { status: 404 });
    }

    const deliveries = message.deliveries.map((delivery) => delivery.user);

    const data: DeliveryInfo = {
      deliveries,
    };
    return Response.json(data);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
