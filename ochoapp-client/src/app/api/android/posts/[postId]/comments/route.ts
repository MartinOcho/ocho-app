// /api/android/posts/[postId]/like/route.ts
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  ApiResponse,
  VerifiedUser,
  Comment,
  CommentsPage,
} from "../../../utils/dTypes";
import { getCommentDataIncludes } from "@/lib/types";
import { getCurrentUser } from "../../../auth/utils";

export async function GET(
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
    // Fin de la vérification de l'appareil
    const userId = user.id;

    const pageSize = 5;
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;

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

    const commentsFromdb = await prisma.comment.findMany({
      where: { postId, firstLevelCommentId: null },
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
      cursor: cursor ? { id: cursor } : undefined,
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

    const comments = await Promise.all(commentsFromdb.map(async (comment) => {
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
      const isLikedByAuthor = comment.likes.some(
        (like) => like.userId === comment.post.userId,
      );
      const isRepliedByAuthor = !!comment.replies.length;
      const postId = comment.postId;
      const postAuthorId = comment.post.userId;
      const replies = await prisma.comment.count({
        where: {
          firstLevelCommentId: comment.id,
        },
      });
      return {
        id,
        author,
        content,
        createdAt,
        likes,
        isLiked,
        isLikedByAuthor,
        isRepliedByAuthor,
        postId,
        postAuthorId,
        replies,
      } as Comment;
    }));

    const nextCursor =
      commentsFromdb.length > pageSize ? commentsFromdb[pageSize].id : null;

    const responseData: CommentsPage = {
      comments: comments.slice(0, pageSize),
      nextCursor,
    };
    return NextResponse.json({
      success: true,
      message: "Comments retrieved successfully.",
      data: responseData,
    } as ApiResponse<CommentsPage>);
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      success: false,
      message: "Something went wrong. Please try again.",
    } as ApiResponse<null>);
  }
}
