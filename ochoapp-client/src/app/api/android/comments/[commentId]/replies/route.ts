// /api/android/posts/[postId]/like/route.ts
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  ApiResponse,
  VerifiedUser,
  Reply,
  RepliesPage,
} from "../../../utils/dTypes";
import { getCommentDataIncludes } from "@/lib/types";
import { getCurrentUser } from "../../../auth/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const { commentId } = await params;
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

    const pageSize = 3;
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;

    const comments = await prisma.comment.findMany({
      where: { firstLevelCommentId: commentId },
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
      cursor: cursor ? { id: cursor } : undefined,
      include: getCommentDataIncludes(userId),
    });

    const replies = comments.map((comment) => {
      const userVerifiedData = comment.user.verified?.[0];

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
        id: comment.user.id,
        username: comment.user.username,
        displayName: comment.user.displayName,
        avatarUrl: comment.user.avatarUrl,
        verified,
      };
      const id = comment.id;
      const author = commentUser;
      const content = comment.content;
      const createdAt = comment.createdAt.getTime();
      const likes = comment._count.likes;
      const isLiked = comment.likes.some((like) => like.userId === userId);
      const isLikedByAuthor = comment.likes.some((like) => like.userId === comment.post.userId);
      const postId = comment.postId;
      const postAuthorId = comment.post.userId;
      const replies = comment._count.replies;
      const firstLevelCommentId = comment.firstLevelCommentId!;
      const firstLevelCommentAuthorId = comment.firstLevelComment!.userId;
      const commentId = comment.commentId;
      const commentAuthorId = comment.comment!.userId;

      const commentAuthorData = comment.comment!.user.verified?.[0];

      const commentAuthorExpiresAt =
        commentAuthorData?.expiresAt?.getTime() || null;
      const commentAuthorCanExpire = !!(commentAuthorExpiresAt || null);
        const commentAuthorExpired = commentAuthorCanExpire && commentAuthorExpiresAt
        ? new Date().getTime() < commentAuthorExpiresAt
        : false;
        const commentAuthorIsVerified = !!commentAuthorData && !commentAuthorExpired;

      const verifiedCommentAuthor: VerifiedUser = {
        verified: commentAuthorIsVerified,
        type: commentAuthorData?.type,
        expiresAt: commentAuthorExpiresAt,
      };
      const commentAuthor = {
        id: comment.comment!.user.id,
        username: comment.comment!.user.username,
        displayName: comment.comment!.user.displayName,
        avatarUrl: comment.comment!.user.avatarUrl,
        verified: verifiedCommentAuthor,
      }
      return {
        id,
        author,
        content,
        createdAt,
        likes,
        isLiked,
        isLikedByAuthor,
        postId,
        postAuthorId,
        replies,
        commentId,
        commentAuthorId,
        commentAuthor,
        firstLevelCommentId,
        firstLevelCommentAuthorId,
      } as Reply;
    });

    const nextCursor =
      comments.length > pageSize ? comments[pageSize].id : null;

    const responseData: RepliesPage = {
      replies: replies.slice(0, pageSize),
      nextCursor,
    };
    return NextResponse.json({
      success: true,
      message: "Comments retrieved successfully.",
      data: responseData,
    } as ApiResponse<RepliesPage>);
  } catch (error) {
    console.error("Error in like endpoint:", error);
    return NextResponse.json({
      success: false,
      message: "Something went wrong. Please try again.",
    } as ApiResponse<null>);
  }
}
