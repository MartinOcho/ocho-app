import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { CommentsPage, getCommentDataIncludes } from "@/lib/types";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  try {
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
    const comment = req.nextUrl.searchParams.get("comment") || null;

    const pageSize = 5;

    const { user } = await validateRequest();

    if (!user) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    // Étape 1 : Récupérer le commentaire cible si un commentId est fourni
    let targetComment = null;
    if (comment) {
      targetComment = await prisma.comment.findUnique({
        where: { id: comment },
        include: {
          ...getCommentDataIncludes(user.id),
          firstLevelOf: {
            select: {
              userId: true,
            },
          },
        },
      });
    }

    const commentsData = await prisma.comment.findMany({
      where: {
        postId,
        id: { not: comment || undefined },
        type: { not: "REPLY" },
      },
      include: {
        ...getCommentDataIncludes(user.id),
        firstLevelOf: {
          select: {
            userId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
      cursor: cursor ? { id: cursor } : undefined,
    });

    const comments = commentsData.map((comment) => {
      const isRepliedByAuthor = !!comment?.firstLevelOf.some(
        (reply) => reply.userId === comment.post.userId,
      );

      return { ...comment, isRepliedByAuthor };
    });

    const previousCursor =
      comments.length > pageSize ? comments[pageSize].id : null;
    const isRepliedByAuthor = !!targetComment?.firstLevelOf.some(
      (reply) => reply.userId === targetComment.post.userId,
    );

    const data: CommentsPage = {
      comments:
        targetComment && (comments.length > pageSize ? !previousCursor : previousCursor)
          ? [
              { ...targetComment, isRepliedByAuthor },
              ...comments.slice(0, pageSize).filter(
                (comment) => comment.id !== targetComment.id,
              ),
            ]
          : comments.slice(0, pageSize),
      previousCursor,
    };

    return Response.json(data);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
