import prisma from "@/lib/prisma";
import { getUserDataSelect } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "../../auth/utils";
import { ApiResponse } from "../../utils/dTypes";

export async function GET(
  req: NextRequest,
) {

  try {
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
    const searchQuery = req.nextUrl.searchParams.get("q") || undefined;
    const pageSize = 10; // Définissez la taille de la page

    // Valider la requête et obtenir l'utilisateur connecté

    const { user: loggedInUser, message } = await getCurrentUser();
    if (!loggedInUser) {
      return NextResponse.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      } as ApiResponse<null>);
    }

    const user = await prisma.user.findFirst({
      where: {
        id: loggedInUser.id,
      },
      select: getUserDataSelect(loggedInUser.id, loggedInUser.username),
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      } as ApiResponse<null>);
    }
    const userId = user.id;

    if (searchQuery) {
      const sanitizedQuery = searchQuery.replace(/[%_]/g, "\\$&");
      const users = await prisma.user.findMany({
        where: {
          OR: [
            {
              displayName: {
                contains: sanitizedQuery,
                mode: "insensitive",
              },
            },
            {
              username: {
                contains: sanitizedQuery,
                mode: "insensitive",
              },
            },
          ],
        },
        take: pageSize + 1, // Prendre un élément supplémentaire pour vérifier s'il y a une page suivante
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { id: "asc" },
        select: getUserDataSelect(user.id),
      });

      const nextCursor = users.length > pageSize ? users[pageSize].id : null;
      const usersPage =
        users.length > pageSize ? users.slice(0, pageSize) : users;

      return NextResponse.json<
        ApiResponse<{ users: typeof usersPage; nextCursor: string | null }>
      >({
        success: true,
        data: { users: usersPage, nextCursor },
      });
    }
  }  catch (error) {
    console.error("Erreur lors de la récupération des lectures du message :", error);
    return NextResponse.json({
      success: false,
      message: "Erreur interne du serveur",
      name: "server-error",
      data: null,
      error: error instanceof Error ? error.message : String(error),
    } as ApiResponse<null>);
  }
}
