import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import {
  RoomData,
  FollowerInfo,
  getChatRoomDataInclude,
  getUserDataSelect,
} from "@/lib/types";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  try {
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    const loggedInUserData = await prisma.user.findFirst({
      where: {
        id: {
          equals: loggedInUser.id,
          mode: "insensitive",
        },
      },
      select: getUserDataSelect(userId),
    });

    if (!loggedInUserData) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        followers: {
          where: {
            followerId: loggedInUser.id,
          },
          select: {
            followerId: true,
          },
        },
        _count: {
          select: {
            followers: true,
          },
        },
      },
    });

    if (!user) {
      return Response.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 },
      );
    }

    const data: FollowerInfo = {
      followers: user._count.followers,
      isFollowedByUser: !!user.followers.length,
      isFolowing: loggedInUserData.followers.some(
        ({ followerId }) => followerId === userId,
      ),
      isFriend:
        loggedInUserData.followers.some(
          ({ followerId }) => followerId === userId,
        ) &&
        user.followers.some(({ followerId }) => followerId === loggedInUser.id),
    };
    return Response.json(data);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  try {
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }

    await prisma.$transaction([
      prisma.follow.upsert({
        where: {
          followerId_followingId: {
            followerId: loggedInUser.id,
            followingId: userId,
          },
        },
        create: {
          followerId: loggedInUser.id,
          followingId: userId,
        },
        update: {},
      }),
      prisma.notification.create({
        data: {
          issuerId: loggedInUser.id,
          recipientId: userId,
          type: "FOLLOW",
        },
      }),
    ]);

    const existingRoom: RoomData | null = await prisma.room.findFirst({
      where: {
        isGroup: false,
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: loggedInUser.id } } },
        ],
      },
      include: getChatRoomDataInclude(),
    });
    if (!existingRoom) {
      await prisma.room.create({
        data: {
          name: null,
          isGroup: false,
          members: {
            create: [
              { userId: loggedInUser.id, type: "MEMBER" },
              { userId, type: "MEMBER" },
            ],
          },
        },
        include: getChatRoomDataInclude(), // Inclure les données requises
      });
    }

    return new Response();
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  try {
    const { user: loggedInUser } = await validateRequest();
    if (!loggedInUser) {
      return Response.json({ error: "Action non autorisée" }, { status: 401 });
    }
    await prisma.$transaction([
      prisma.follow.deleteMany({
        where: {
          followerId: loggedInUser.id,
          followingId: userId,
        },
      }),
      prisma.notification.deleteMany({
        where: {
          issuerId: loggedInUser.id,
          recipientId: userId,
          type: "FOLLOW",
        },
      }),
    ]);

    return new Response();
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
