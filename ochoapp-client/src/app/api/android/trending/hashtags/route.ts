import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { ApiResponse, User, VerifiedUser } from "../../utils/dTypes";
import { getUserDataSelect, UserData } from "@/lib/types";
import { getCurrentUser } from "../../auth/utils";

// Définir la structure de retour de la requête SQL
// Note : Le type 'bigint' de la base de données est mappé en 'string' en JavaScript
type TrendingHashtagsResult = {
  hashtag: string;
  postsCount: string;
  likesCount: string;
};

// Endpoint pour récupérer les hashtags tendances
export async function GET(req: NextRequest) {
  try {
     const { user, message } = await getCurrentUser();
    if (!user) {
      return NextResponse.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      } as ApiResponse<null>);
    }

    const result = await prisma.$queryRaw<TrendingHashtagsResult[]>`
        SELECT
            LOWER(unnest(regexp_matches(p.content, '#[[:alnum:]_-]+', 'g'))) AS hashtag,
            COUNT(DISTINCT p.id) AS "postsCount",
            COUNT(l."postId") AS "likesCount"
        FROM posts p
        LEFT JOIN likes l ON p.id = l."postId"
        GROUP BY hashtag
        ORDER BY "postsCount" DESC, "likesCount" DESC
        LIMIT 5
    `;

    // Mapper le résultat pour convertir les BigInt en nombres entiers
    const hashtags = result.map((row) => ({
      name: row.hashtag,
      postsCount: Number(row.postsCount),
      likesCount: Number(row.likesCount),
    }));

    console.log(hashtags);

    return NextResponse.json({
      success: true,
      message: "Trending hashtags fetched successfully",
      data: hashtags,
    } as ApiResponse<
      {
        name: string;
        postsCount: number;
        likesCount: number;
      }[]
    >);
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      success: false,
      message: "An unexpected error occurred",
      name: "unknown",
      data: null,
    } as ApiResponse<null>);
  }
}
