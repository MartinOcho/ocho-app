import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { ApiResponse, User, VerifiedUser } from "../../utils/dTypes";
import { getUserDataSelect, UserData } from "@/lib/types";
import { getCurrentUser } from "../../auth/utils";

// Endpoint pour récupérer les suggestions d'utilisateurs
export async function GET(req: NextRequest) {
  try {
     const { user: loggedUser, message } = await getCurrentUser();
        if (!loggedUser) {
          return NextResponse.json({
            success: false,
            message: message || "Utilisateur non authentifié.",
            name: "unauthorized",
          } as ApiResponse<null>);
        }
    // Exécuter la requête Prisma pour trouver les utilisateurs à suggérer
    const usersToFollow = await prisma.user.findMany({
      where: {
        NOT: {
          id: loggedUser.id,
        },
        followers: {
          none: {
            followerId: loggedUser.id,
          },
        },
      },
      select: getUserDataSelect(loggedUser.id),
      orderBy: {
        followers: {
          _count: "desc",
        },
      },
      take: 5,
    });

    // Mapper les résultats pour correspondre à la structure de données attendue par le client
    const suggestedUsers = usersToFollow.map((user: UserData) => {
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

      return {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl || undefined,
        bio: user.bio || undefined,
        verified,
        createdAt: user.createdAt.getTime(),
        lastSeen: user.lastSeen.getTime(),
        followersCount: user?._count.followers || 0,
        postsCount: user?._count.posts || 0,
        isFollowing,
      };
    });

    return NextResponse.json({
      success: true,
      message: "Suggested users fetched successfully",
      data: suggestedUsers,
    } as ApiResponse<User[]>);
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      success: false,
      message: "An unexpected error occurred",
      name: "unknown",
      data: null,
    } as ApiResponse<null>);
  }
}
