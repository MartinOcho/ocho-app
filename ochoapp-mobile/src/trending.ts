import { Request, Response } from "express";
import prisma from "./prisma";
import { getCurrentUser } from "./auth";
import { ApiResponse, TrendingHashtagsResult } from "./types";

export async function getTrendingHashtags(req: Request, res: Response) {
  try {
     const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
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

    return res.json({
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
    return res.json({
      success: false,
      message: "An unexpected error occurred",
      name: "unknown",
      data: null,
    } as ApiResponse<null>);
  }
}