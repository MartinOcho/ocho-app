// /api/android/posts/[postId]/like/route.ts
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  ApiResponse,
  VerifiedUser,
  Comment,
} from "../../../../utils/dTypes";
import { getCommentDataIncludes } from "@/lib/types";
import { createCommentSchema } from "@/lib/validation";
import { getCurrentUser } from "@/app/api/android/auth/utils";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
   // Lire le corps de la requête UNE SEULE FOIS au début
    let body;
    try {
      body = await req.json() as Comment;
    } catch (e) {
      console.error("Erreur lors de la lecture du corps de la requête (JSON invalide):", e);
      return NextResponse.json({
        success: false,
        message: "Requête invalide: le corps doit être un JSON valide.",
      } as ApiResponse<null>);
    }
  try {
    const { user, message } = await getCurrentUser();
    if (!user) {
      return NextResponse.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      } as ApiResponse<null>);
    }
    // Fin de la vérification de l'appareil
    const userId = user.id;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (!post) {
      return NextResponse.json({
        success: false,
        message: "Post not found.",
      } as ApiResponse<null>);
    }

    const { content: newCContent } = body;

    const { content } = createCommentSchema.parse({ content: newCContent});

    const newComment = await prisma.comment.create({
      data: {
        content,
        postId,
        userId,
        type: "COMMENT"
      },
      include: {
        ...getCommentDataIncludes(userId),
        replies: {
          where: {
            post: {
              userId: post.userId,
            },
          },
          select: {
            id: true,
          },
        },
      },
    });

    const userVerifiedData = newComment.user.verified?.[0];

    const expiresAt = userVerifiedData?.expiresAt?.getTime() || null;
    const canExpire = !!(expiresAt || null);

    const expired =
      canExpire && expiresAt ? new Date().getTime() < expiresAt : false;

    const isVerified = !!userVerifiedData && !expired;

    const verified: VerifiedUser = {
      verified: isVerified,
      type: userVerifiedData?.type,
      expiresAt,
    };

    const commentUser = {
      id: newComment.user.id,
      username: newComment.user.username,
      displayName: newComment.user.displayName,
      avatarUrl: newComment.user.avatarUrl as string | undefined,
      verified,
    };
    const id = newComment.id;
    const author = commentUser;
    const newContent = newComment.content;
    const createdAt = newComment.createdAt.getTime();
    const likes = newComment._count.likes;
    const isLiked = newComment.likes.some((like) => like.userId === userId);
    const isLikedByAuthor = newComment.likes.some(
      (like) => like.userId === newComment.post.userId,
    );
    const isRepliedByAuthor = !!newComment.replies.length;
    const postAuthorId = newComment.post.userId;
    const replies = await prisma.comment.count({
      where: {
        firstLevelCommentId: newComment.id,
      },
    });

    const comment: Comment = {
      id,
      author,
      content: newContent,
      createdAt,
      likes,
      isLiked,
      isLikedByAuthor,
      isRepliedByAuthor,
      postId,
      postAuthorId,
      replies,
    };

    return NextResponse.json({
      success: true,
      message: "Comments sent successfully.",
      data: comment,
    } as ApiResponse<Comment>);
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      success: false,
      message: "Something went wrong. Please try again.",
    } as ApiResponse<null>);
  }
}
