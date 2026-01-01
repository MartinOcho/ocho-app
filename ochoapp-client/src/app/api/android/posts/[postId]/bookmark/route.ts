// /api/android/posts/[postId]/like/route.ts
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { ApiResponse } from "../../../utils/dTypes";
import { getCurrentUser } from "../../../auth/utils";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  try {
    const { user, message } = await getCurrentUser();
    if (!user) {
      return NextResponse.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      } as ApiResponse<null>);
    }
    const userId = user.id;
    let isBookmarked = false;

    // Utilise une transaction pour garantir que les opérations sont atomiques
    await prisma.$transaction(async (prisma) => {
      const existingBookmark = await prisma.bookmark.findUnique({
         where: {
                userId_postId: {
                    userId,
                    postId
                }
            },
      });

      if (existingBookmark) {
        // Si le like existe, on le supprime
        await prisma.bookmark.delete({
          where: {
            userId_postId: { userId, postId },
          },
        });
        isBookmarked = false;
      } else {
        // Sinon, on le crée
        await prisma.bookmark.create({
          data: {
            postId,
            userId,
          },
        });

        // Crée une notification si l'utilisateur n'est pas l'auteur du post
        const post = await prisma.post.findUnique({
          where: { id: postId },
          select: { userId: true },
        });
        isBookmarked = true;
      }
    });


    return NextResponse.json({
      success: true,
      message: "Post bookmarked successfully.",
      data: { isBookmarked },
    } as ApiResponse<{ isBookmarked: boolean; }>);
  } catch (error) {
    console.error("Error in like endpoint:", error);
    return NextResponse.json({
      success: false,
      message: "Something went wrong. Please try again.",
    } as ApiResponse<null>);
  }
}
