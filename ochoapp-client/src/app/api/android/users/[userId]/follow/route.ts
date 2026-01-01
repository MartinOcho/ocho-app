import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { ApiResponse, User, VerifiedUser } from "../../../utils/dTypes";
import { getUserDataSelect, UserData } from "@/lib/types";
import { get } from "http";
import { getCurrentUser } from "../../../auth/utils";

// Endpoint pour récupérer un profil utilisateur par ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  try {
     const { user: loggedUser, message } = await getCurrentUser();
        if (!loggedUser) {
          return NextResponse.json({
            success: false,
            message: message || "Utilisateur non authentifié.",
            name: "unauthorized",
          } as ApiResponse<null>);
        }
    // Correction : l'ID de l'utilisateur est dans les params

    if (!userId) {
      return NextResponse.json({
        success: false,
        message: "User ID is required",
        name: "no_id",
      } as ApiResponse<null>);
    }

    const user = (await prisma.user.findFirst({
      where: {
        OR: [
          { id: userId },
          { username: userId }, // Permet de chercher par nom d'utilisateur aussi
        ],
      },
      select: getUserDataSelect(loggedUser.id),
    })) as UserData | undefined;

    if (!user) {
      return NextResponse.json({
        success: false,
        message: "User not found",
        name: "user_not_found",
      } as ApiResponse<null>);
    }

    const userIsCurrentUser = loggedUser.id === user.id;
    if (userIsCurrentUser) {
      return NextResponse.json({
        success: true,
        message: "You can't follow yourself",
        data: user,
      } as ApiResponse<UserData>);
    }

    const userVerifiedData = user.verified?.[0];
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

    let isFollowing = user.followers.some(
      (follower) => follower.followerId === loggedUser.id,
    );

    if (isFollowing) {
      // Si l'utilisateur est déjà suivi, on le retire des followers
      await prisma.$transaction([
        prisma.follow.deleteMany({
          where: {
            followerId: loggedUser.id,
            followingId: user.id,
          },
        }),
        prisma.notification.deleteMany({
          where: {
            issuerId: loggedUser.id,
            recipientId: user.id,
            type: "FOLLOW",
          },
        }),
      ]);
    } else {
      // Si l'utilisateur n'est pas suivi, on l'ajoute aux followers
      await prisma.$transaction([
        prisma.follow.create({
          data: {
            followerId: loggedUser.id,
            followingId: user.id,
          },
        }),
        prisma.notification.create({
          data: {
            issuerId: loggedUser.id,
            recipientId: user.id,
            type: "FOLLOW",
          },
        }),
      ]);
    }
    // Recalculer le nombre de followers et posts
    const updatedUser = (await prisma.user.findUnique({
      where: { id: user.id },
      select: getUserDataSelect(loggedUser.id),
    })) as UserData | null;
    if (!updatedUser) {
      return NextResponse.json({
        success: false,
        message: "User not found after update",
        name: "user_not_found",
      } as ApiResponse<null>);
    }
    isFollowing = updatedUser.followers.some(
      (follower) => follower.followerId === loggedUser.id,
    );

    const finalUser: User = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl || undefined,
      bio: user.bio || undefined,
      verified,
      createdAt: user.createdAt.getTime(),
      lastSeen: user.lastSeen.getTime(),
      followersCount: updatedUser?._count.followers || 0,
      postsCount: updatedUser?._count.posts || 0,
      isFollowing,
    };

    return NextResponse.json({
      success: true,
      message: "User follow status updated",
      data: finalUser,
    } as ApiResponse<User>);
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      success: false,
      message: "An unexpected error occurred",
      name: "unknown",
    } as ApiResponse<null>);
  }
}
