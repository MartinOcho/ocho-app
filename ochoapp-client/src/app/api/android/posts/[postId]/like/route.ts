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
    let isLiked = false;

    // Utilise une transaction pour garantir que les opérations sont atomiques
    await prisma.$transaction(async (prisma) => {
      const existingLike = await prisma.like.findFirst({
        where: { postId: postId, userId: userId },
      });

      if (existingLike) {
        // Si le like existe, on le supprime
        await prisma.like.delete({
          where: {
            userId_postId: { userId, postId },
          },
        });
        isLiked = false;
      } else {
        // Sinon, on le crée
        await prisma.like.create({
          data: {
            postId: postId,
            userId: userId,
          },
        });

        // Crée une notification si l'utilisateur n'est pas l'auteur du post
        const post = await prisma.post.findUnique({
          where: { id: postId },
          select: { userId: true },
        });

        if (post && post.userId !== userId) {
          await prisma.notification.create({
            data: {
              issuerId: userId,
              recipientId: post.userId,
              postId: postId,
              type: "LIKE",
            },
          });
        }
        isLiked = true;
      }
    });

    // Compte le nombre de likes après la transaction
    const likesCount = await prisma.like.count({
      where: { postId: postId },
    });

    return NextResponse.json({
      success: true,
      message: "Like action successful.",
      data: { isLiked, likesCount },
    } as ApiResponse<{ isLiked: boolean; likesCount: number }>);
  } catch (error) {
    console.error("Error in like endpoint:", error);
    return NextResponse.json({
      success: false,
      message: "Something went wrong. Please try again.",
    } as ApiResponse<null>);
  }
}
