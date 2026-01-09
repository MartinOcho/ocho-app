// api/android/search/[filter]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  ApiResponse,
  PostsIdsPage,
} from "../../../utils/dTypes";
import { getPostDataIncludes, UserData } from "@/lib/types";
import { getCurrentUser } from "../../../auth/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filter: string }> },
) {
  const { filter } = await params;
  try {
     const { user, message } = await getCurrentUser();
    if (!user) {
      return NextResponse.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      } as ApiResponse<null>);
    }

    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
    const pageSize = 5;

    // 1. Analyser l'URL pour obtenir les paramètres de requête
    const q = req.nextUrl.searchParams.get("q");

    // 2. Préparation de la requête de recherche full-text
    if (!q) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        message: "Le paramètre de requête 'q' est manquant pour la recherche.",
        name: "MissingQueryParameter",
        data: null,
      });
    }

    // Logique de création de la requête de recherche full-text (ex: "mot1 mot2" -> "mot1:* & mot2:*")
    const searchQuery = q
      .split(" ")
      .map((term) => `${term}:*`)
      .join(" & ");

    // 3. Exécution de la requête Prisma pour les posts
    // L'utilisateur 'user' est garanti d'être non-null ici
    // --- Logique de recherche unifiée par filtre ---
    switch (filter.toLowerCase()) {
      case "posts": {
        const posts = await prisma.post.findMany({
          where: {
            OR: [
              { content: { search: searchQuery } },
              { user: { displayName: { search: searchQuery } } },
              { user: { username: { search: searchQuery } } },
            ],
          },
          // Utilisation de la fonction d'inclusion réelle
          include: getPostDataIncludes(user!.id),
          orderBy: { createdAt: "desc" },
          take: pageSize + 1,
          cursor: cursor ? { id: cursor } : undefined,
        }); // Cast des résultats pour correspondre à l'interface Post

        const results = posts.map((post) => {
            return post.id
        });

        // 4. Déterminer le prochain curseur et formater les données
        const nextCursor =
          results.length > pageSize ? results[pageSize] : null;

        const postsPage: PostsIdsPage = {
          posts: results.slice(0, pageSize),
          nextCursor,
        };

        // 5. Retourner la réponse au format ApiResponse
        return NextResponse.json<ApiResponse<PostsIdsPage>>({
          success: true,
          message: `Résultats de recherche pour les posts récupérés (terme: ${q}).`,
          name: "SearchPostsSuccess",
          data: postsPage,
        });
      }
      default:
        // Si le filtre n'est pas "posts", retourner une erreur
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          message: `Filtre de recherche non supporté: ${filter}. Seul 'posts' est actuellement implémenté.`,
          name: "UnsupportedFilter",
          data: null,
        });
    }
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "Internal server error",
      name: "server-error",
      data: null,
    } as ApiResponse<null>);
  }
}
