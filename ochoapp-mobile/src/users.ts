import { Request, Response } from "express";
import prisma from "./prisma";
import { ApiResponse, getUserDataSelect, User, UserData, VerifiedUser } from "./types";
import { checkVerification, getCurrentUser } from "./auth";
import { log } from "console";

export async function getUserProfile(req: Request, res: Response) {
  const { userId } = req.params;
  try {
    const { user: loggedUser, message } = await getCurrentUser(req.headers);
    if (!loggedUser) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    if (!userId) {
      return res.json({
        success: false,
        message: "User ID is required",
        name: "no_id",
      });
    }

    const user = (await prisma.user.findFirst({
      where: {
        OR: [{ id: userId }, { username: userId }],
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        lastSeen: true,
        verified: {
          select: {
            type: true,
            expiresAt: true,
          },
        },
        followers: {
          where: { followerId: loggedUser.id },
          select: { followerId: true },
        },
        _count: {
          select: {
            followers: true,
            posts: true,
          },
        },
      },
    })) as UserData | undefined;

    if (!user) {
      return res.json({
        success: false,
        message: "User not found",
        name: "user_not_found",
      });
    }

    const verified = await checkVerification(user);
    const isFollowing = user.followers.some(
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
      followersCount: user._count.followers,
      postsCount: user._count.posts,
      isFollowing,
    };

    return res.json({
      success: true,
      message: "User retrieved successfully",
      data: finalUser,
    });
  } catch (error) {
    console.error(error);
    return res.json({
      success: false,
      message: "An unexpected error occurred",
      name: "unknown",
    });
  }
}

export async function updateUserProfile(req: Request, res: Response) {
  const { userId } = req.params;
  try {
    const { user: loggedUser, message } = await getCurrentUser(req.headers);
    if (!loggedUser) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    if (loggedUser.id !== userId && loggedUser.username !== userId) {
      return res.json({
        success: false,
        message: "You can only update your own profile.",
        name: "forbidden",
        data: null,
      });
    }

    const { displayName, bio, avatarUrl, avatarId, roomId } = req.body;

    let updateData: any = {
      displayName: displayName ?? loggedUser.displayName,
      bio: bio ?? loggedUser.bio,
    };

    if (roomId) {
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          members: {
            where: { userId: loggedUser.id },
            select: { type: true },
          },
        },
      });

      if (!room || !room.isGroup) {
        return res.json({
          success: false,
          message: "Group not found or not a group.",
          name: "group_not_found",
        });
      }

      const member = room.members[0];
      if (!member || !["ADMIN", "OWNER"].includes(member.type)) {
        return res.json({
          success: false,
          message: "Insufficient permissions to update group avatar.",
          name: "forbidden",
        });
      }

      await prisma.room.update({
        where: { id: roomId },
        data: { groupAvatarUrl: avatarUrl },
      });

      if (avatarId) {
        await prisma.userAvatar.deleteMany({
          where: { id: avatarId, userId: loggedUser.id },
        });
      }

      return res.json({
        success: true,
        message: "Group avatar updated successfully",
        data: null,
      });
    } else {
      if (avatarUrl !== undefined) {
        updateData.avatarUrl = avatarUrl;
      }

      if (avatarId) {
        await prisma.userAvatar.deleteMany({
          where: { id: avatarId, userId: loggedUser.id },
        });
      }
    }

    const updatedUser = (await prisma.user.update({
      where: { id: loggedUser.id },
      data: updateData,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        lastSeen: true,
        verified: {
          select: {
            type: true,
            expiresAt: true,
          },
        },
        followers: {
          where: { followerId: loggedUser.id },
          select: { followerId: true },
        },
        _count: {
          select: {
            followers: true,
            posts: true,
          },
        },
      },
    })) as UserData;

    const verified = await checkVerification(updatedUser);
    const isFollowing = updatedUser.followers.some(
      (follower) => follower.followerId === loggedUser.id,
    );

    const finalUser: User = {
      id: updatedUser.id,
      username: updatedUser.username,
      displayName: updatedUser.displayName,
      avatarUrl: updatedUser.avatarUrl || undefined,
      bio: updatedUser.bio || undefined,
      verified,
      createdAt: updatedUser.createdAt.getTime(),
      lastSeen: updatedUser.lastSeen.getTime(),
      followersCount: updatedUser._count.followers,
      postsCount: updatedUser._count.posts,
      isFollowing,
    };

    return res.json({
      success: true,
      message: "Profile updated successfully",
      data: finalUser,
    });
  } catch (error) {
    console.error(error);
    return res.json({
      success: false,
      message: "An unexpected error occurred",
      name: "unknown",
    });
  }
}

export async function toggleFollow(req: Request, res: Response) {
  const { userId } = req.params;
  try {
    const { user: loggedUser, message } = await getCurrentUser(req.headers);
    if (!loggedUser) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    if (!userId) {
      return res.json({
        success: false,
        message: "User ID is required",
        name: "no_id",
      });
    }

    const user = (await prisma.user.findFirst({
      where: {
        OR: [{ id: userId }, { username: userId }],
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        lastSeen: true,
        verified: {
          select: {
            type: true,
            expiresAt: true,
          },
        },
        followers: {
          where: { followerId: loggedUser.id },
          select: { followerId: true },
        },
        _count: {
          select: {
            followers: true,
            posts: true,
          },
        },
      },
    })) as UserData | undefined;

    if (!user) {
      return res.json({
        success: false,
        message: "User not found",
        name: "user_not_found",
      });
    }

    const userIsCurrentUser = loggedUser.id === user.id;
    if (userIsCurrentUser) {
      return res.json({
        success: true,
        message: "You can't follow yourself",
        data: user,
      });
    }

    const verified = await checkVerification(user);

    let isFollowing = user.followers.some(
      (follower) => follower.followerId === loggedUser.id,
    );

    if (isFollowing) {
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

    const updatedUser = (await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        lastSeen: true,
        verified: {
          select: {
            type: true,
            expiresAt: true,
          },
        },
        followers: {
          where: { followerId: loggedUser.id },
          select: { followerId: true },
        },
        _count: {
          select: {
            followers: true,
            posts: true,
          },
        },
      },
    })) as UserData | null;

    if (!updatedUser) {
      return res.json({
        success: false,
        message: "User not found after update",
        name: "user_not_found",
      });
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
      followersCount: updatedUser._count.followers,
      postsCount: updatedUser._count.posts,
      isFollowing,
    };

    return res.json({
      success: true,
      message: "User follow status updated",
      data: finalUser,
    });
  } catch (error) {
    console.error(error);
    return res.json({
      success: false,
      message: "An unexpected error occurred",
      name: "unknown",
    });
  }
}

export async function getSuggestedUsers(req: Request, res: Response) {
  try {
     const { user: loggedUser, message } = await getCurrentUser(req.headers);
        if (!loggedUser) {
          return res.json({
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

    return res.json({
      success: true,
      message: "Suggested users fetched successfully",
      data: suggestedUsers,
    } as ApiResponse<User[]>);
  } catch (error) {
    console.error(error);
    return res.json({
      success: false,
      message: "An unexpected error occurred",
      name: "unknown",
      data: null,
    } as ApiResponse<null>);
  }
}