import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { ReactionData } from "@/lib/types";

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
            select: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  username: true,
                  avatarUrl: true,
                },
              },
              content: true,
            },
          },
        },
      });
  
      if (!message) {
        return Response.json({ error: "Message non trouvé" }, { status: 404 });
      }
  
      const reactions: ReactionData[] = message.reactions;
  
      return Response.json(reactions);
    } catch (error) {
      console.error(error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  }