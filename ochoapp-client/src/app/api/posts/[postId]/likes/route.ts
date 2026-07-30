import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { LikeInfo } from "@/lib/types";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  try {
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    const post = await prisma.post.findUnique({
      where: {
        id: postId,
        OR: [
          {
            userId: loggedInUser.id,
          },
          {
            visibility: "FOLLOWERS",
            user: {
              followers: {
                some: {
                  followerId: loggedInUser.id,
                },
              },
            },
          },
          {
            visibility: "PUBLIC",
          },
        ],
      },
      select: {
        likes: {
          where: {
            userId: loggedInUser.id,
          },
          select: {
            userId: true,
          },
        },
        _count: {
          select: {
            likes: true,
          },
        },
      },
    });

    if (!post) {
      return Response.json({ error: "Post non trouvé" }, { status: 404 });
    }

    const data: LikeInfo = {
      likes: post._count.likes,
      isLikedByUser: !!post.likes.length,
    };
    return Response.json(data);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  try {
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    const post = await prisma.post.findUnique({
      where: {
        id: postId,
        OR: [
          {
            userId: loggedInUser.id,
          },
          {
            visibility: "FOLLOWERS",
            user: {
              followers: {
                some: {
                  followerId: loggedInUser.id,
                },
              },
            },
          },
          {
            visibility: "PUBLIC",
          },
        ],
      },
      select: {
        userId: true,
      },
    });

    if (!post) {
      return Response.json({ error: "Post non trouvé" }, { status: 404 });
    }

    await prisma.like.upsert({
      where: {
        userId_postId: {
          userId: loggedInUser.id,
          postId,
        },
      },
      create: {
        userId: loggedInUser.id,
        postId,
      },
      update: {},
    });

    return new Response();
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  try {
    const { user: loggedInUser } = await validateRequest();
    if (!loggedInUser) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    const post = await prisma.post.findUnique({
      where: {
        id: postId,
        OR: [
          {
            userId: loggedInUser.id,
          },
          {
            visibility: "FOLLOWERS",
            user: {
              followers: {
                some: {
                  followerId: loggedInUser.id,
                },
              },
            },
          },
          {
            visibility: "PUBLIC",
          },
        ],
      },
      select: {
        userId: true,
      },
    });

    if (!post) {
      return Response.json({ error: "Post non trouvé" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.like.deleteMany({
        where: {
          userId: loggedInUser.id,
          postId,
        },
      }),
      prisma.notification.deleteMany({
        where: {
          postId,
          issuerId: loggedInUser.id,
          recipientId: post.userId,
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
