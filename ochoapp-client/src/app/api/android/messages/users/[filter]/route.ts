import prisma from "@/lib/prisma";
import { getUserDataSelect } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "../../../auth/utils";
import { ApiResponse } from "../../../utils/dTypes";
import { Prisma } from "@prisma/client";

export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ filter: string | undefined }>;
  },
) {
  const { filter } = await params;

  try {
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
    const searchQuery = req.nextUrl.searchParams.get("q") || undefined;
    const pageSize = 10;

    // 1. Authentification
    const { user: loggedInUser, message } = await getCurrentUser();
    if (!loggedInUser) {
      return NextResponse.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      } as ApiResponse<null>);
    }

    const user = await prisma.user.findFirst({
      where: { id: loggedInUser.id },
      select: getUserDataSelect(loggedInUser.id, loggedInUser.username),
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        message: "Utilisateur introuvable.",
        name: "unauthorized",
      } as ApiResponse<null>);
    }

    // 2. Préparation de la condition de recherche (Search Query)
    // Cette condition sera injectée dans chaque filtre si une recherche existe
    let searchCondition: Prisma.UserWhereInput | undefined = undefined;

    if (searchQuery) {
      const sanitizedQuery = searchQuery.replace(/[%_]/g, "\\$&");
      searchCondition = {
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
      };
    }

    // 3. Construction de la clause WHERE en fonction du filtre
    let whereClause: Prisma.UserWhereInput = {};

    switch (filter) {
      case "friends":
        whereClause = {
          AND: [
            { followers: { some: { followerId: user.id } } }, // Ils me suivent
            { following: { some: { followingId: user.id } } }, // Je les suis
            // Si une recherche existe, on l'ajoute ici
            ...(searchCondition ? [searchCondition] : []),
          ],
        };
        break;

      case "followers":
        whereClause = {
          AND: [
            { followers: { some: { followerId: user.id } } }, // Ils me suivent
            { NOT: { following: { some: { followingId: user.id } } } }, // Je ne les suis PAS (pour éviter les doublons avec amis)
            ...(searchCondition ? [searchCondition] : []),
          ],
        };
        break;

      case "following":
        whereClause = {
          AND: [
            { following: { some: { followingId: user.id } } }, // Je les suis
            { NOT: { followers: { some: { followerId: user.id } } } }, // Ils ne me suivent PAS
            ...(searchCondition ? [searchCondition] : []),
          ],
        };
        break;

      default:
        // Suggestions (Ni amis, ni suivis, ni moi-même)
        whereClause = {
          AND: [
            { followers: { none: { followerId: user.id } } },
            { following: { none: { followingId: user.id } } },
            { id: { not: user.id } },
            ...(searchCondition ? [searchCondition] : []),
          ],
        };
        break;
    }

    // 4. Exécution unique de la requête
    // On utilise la clause `where` construite dynamiquement ci-dessus
    const users = await prisma.user.findMany({
      where: whereClause,
      take: pageSize + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: "asc" }, // Ou par défaut par username si vous préférez
      select: getUserDataSelect(user.id),
    });

    // 5. Pagination
    const nextCursor = users.length > pageSize ? users[pageSize].id : null;
    const usersPage = users.length > pageSize ? users.slice(0, pageSize) : users;

    return NextResponse.json<
      ApiResponse<{ users: typeof usersPage; nextCursor: string | null }>
    >({
      success: true,
      data: { users: usersPage, nextCursor },
    });

  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs :", error);
    return NextResponse.json({
      success: false,
      message: "Erreur interne du serveur",
      name: "server-error",
      data: null,
      error: error instanceof Error ? error.message : String(error),
    } as ApiResponse<null>);
  }
}
