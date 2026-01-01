import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const { user } = await validateRequest();
  if (!user) {
    return Response.json({ error: "Action non autorisée" }, { status: 401 });
  }

  // 61 seconds in future
  const expirationDate = new Date(Date.now() + 61 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastSeen: expirationDate,
    },
  });
  return new Response();
}
