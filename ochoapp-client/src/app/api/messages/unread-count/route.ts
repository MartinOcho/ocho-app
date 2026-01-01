import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NotificationCountInfo } from "@/lib/types";

export async function GET() {
  try {
    const { user } = await validateRequest();

    if (!user) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    const unreadCount = await prisma.room.count({
      where: {
        members: {
          some: {
            userId: user.id,
          },
        },
        messages: {
          some: {
            type: { not: "CREATE" },
            reads: {
              none: {
                userId: user.id,
              },
            },
          },
        },
      },
    });

    const data: NotificationCountInfo = {
      unreadCount,
    };

    return Response.json(data);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
