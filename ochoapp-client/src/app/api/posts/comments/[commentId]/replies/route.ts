import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { RepliesPage, getCommentDataIncludes } from "@/lib/types";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const { commentId } = await params;
  try {
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
    const comment = req.nextUrl.searchParams.get("comment") || null;

    const pageSize = 3;
    const firstLevelCommentId = commentId;

    const { user } = await validateRequest();

    if (!user) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    // Étape 1 : Récupérer le commentaire cible si un commentId est fourni
    let targetComment = null;
    // if (comment) {
    //   targetComment = await prisma.comment.findUnique({
    //     where: { id: comment, type: { not: "COMMENT" } },
    //     include: getCommentDataIncludes(user.id),
    //   });
    // }

    const comments = await prisma.comment.findMany({
      where: {
        firstLevelCommentId,
        id: { not: comment || undefined },
        type: { not: "COMMENT" },
      },
      include: getCommentDataIncludes(user.id),
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
      cursor: cursor ? { id: cursor } : undefined,
    });
    
    const previousCursor = comments.length > pageSize ? comments[pageSize].id : null;

    const count = await prisma.comment.count({
      where: {
        firstLevelCommentId,
        type: { not: "COMMENT" },
      },
    })
    
    const data: RepliesPage = {
      replies: comments.slice(0, pageSize),
      previousCursor,
      count
    };
    
    return Response.json(data);
    
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
