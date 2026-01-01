import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { LikeInfo } from "@/lib/types";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const { commentId } = await params;
  try {
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        likes: {
          select: {
            userId: true,
          },
        },
        _count: {
          select: {
            likes: true,
          },
        },
        post: {
          select: {
            userId: true,
          },
        },
      },
    });

    const isLikedByAuthor =
      comment?.likes.some((like) => like.userId === comment.post.userId) ||
      false;
    const isLikedByUser =
      comment?.likes.some((like) => like.userId === loggedInUser.id) || false;

    if (!comment) {
      return Response.json(
        { error: "Commentaire non trouvé" },
        { status: 404 },
      );
    }

    const data: LikeInfo = {
      likes: comment._count.likes,
      isLikedByUser,
      isLikedByAuthor,
    };
    return Response.json(data);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const { commentId } = await params;
  try {
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        userId: true,
      },
    });

    if (!comment) {
      return Response.json(
        { error: "Commentaire non trouvé" },
        { status: 404 },
      );
    }

    await prisma.$transaction([
      prisma.commentLike.upsert({
        where: {
          userId_commentId: {
            userId: loggedInUser.id,
            commentId,
          },
        },
        create: {
          userId: loggedInUser.id,
          commentId,
        },
        update: {},
      }),
      ...(loggedInUser.id !== comment.userId
        ? [
            prisma.notification.create({
              data: {
                issuerId: loggedInUser.id,
                recipientId: comment.userId,
                commentId,
                type: "COMMENT_LIKE",
              },
            }),
          ]
        : []),
    ]);

    return new Response();
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const { commentId } = await params;
  try {
    const { user: loggedInUser } = await validateRequest();
    if (!loggedInUser) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        userId: true,
      },
    });

    if (!comment) {
      return Response.json(
        { error: "Commentaire non trouvé" },
        { status: 404 },
      );
    }

    await prisma.$transaction([
      prisma.commentLike.deleteMany({
        where: {
          userId: loggedInUser.id,
          commentId,
        },
      }),
      prisma.notification.deleteMany({
        where: {
          commentId,
          issuerId: loggedInUser.id,
          recipientId: comment.userId,
          type: "LIKE",
        },
      }),
    ]);

    return new Response();
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
