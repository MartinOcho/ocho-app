import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { ApiResponse, User, VerifiedUser } from "../../utils/dTypes";
import { getUserDataSelect, UserData } from "@/lib/types";
import { getCurrentUser } from "../../auth/utils";

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
    const isFollowing = user.followers.some(follower=>follower.followerId === loggedUser.id)

    const finalUser: User = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl || undefined,
      bio: user.bio || undefined,
      verified,
      createdAt: user.createdAt.getTime(),
      lastSeen: user.lastSeen.getTime(),
      followersCount: user._count.followers,
      postsCount: user._count.posts,
      isFollowing
    };

    return NextResponse.json({
      success: true,
      message: "User retrieved successfully",
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

// Endpoint pour la modification de profil utilisateur
export async function PATCH(
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

    if (loggedUser.id !== userId) {
      return NextResponse.json({
        success: false,
        message: "You can only update your own profile.",
        name: "forbidden",
        data: null,
      } as ApiResponse<null>);
    }

    const { displayName, bio, avatarUrl } = await req.json();

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        displayName: displayName ?? loggedUser.displayName,
        bio: bio ?? loggedUser.bio,
        // avatarUrl: avatarUrl ?? loggedUser.avatarUrl,
      },
      select: getUserDataSelect(loggedUser.id),
    }) as UserData;

    const userVerifiedData = updatedUser.verified?.[0];
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
    const isFollowing = updatedUser.followers.some(follower=>follower.followerId === loggedUser.id)

    const finalUser: User = {
      id: updatedUser.id,
      username: updatedUser.username,
      displayName: updatedUser.displayName,
      avatarUrl: updatedUser.avatarUrl || undefined,
      bio: updatedUser.bio || undefined,
      verified: verified,
      createdAt: updatedUser.createdAt.getTime(),
      lastSeen: updatedUser.lastSeen.getTime(),
      followersCount: updatedUser?._count.followers || 0,
      postsCount: updatedUser?._count.posts || 0,
      isFollowing,
    };

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
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