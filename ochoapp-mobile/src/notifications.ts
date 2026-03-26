import { Request, Response } from "express";
import prisma from "./prisma";
import { User, VerifiedUser } from "./types";
import { getCurrentUser } from "./auth";

export async function getNotifications(req: Request, res: Response) {
  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "invalid_session",
      });
    }

    const currentUserId = user.id;

    const cursor = req.query.cursor as string | undefined;
    const pageSize = 10;

    const notifications = await prisma.notification.findMany({
      where: {
        recipientId: currentUserId,
      },
      include: {
        issuer: {
          select: {
            verified: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        post: {
          select: {
            id: true,
            userId: true,
            content: true,
            attachments: true,
          },
        },
        comment: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            postId: true,
            user: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
      cursor: cursor ? { id: cursor } : undefined,
    });

    const nextCursor =
      notifications.length > pageSize ? notifications[pageSize].id : null;

    const finalNotifications = notifications.slice(0, pageSize).map((notif) => {
      const userVerifiedData = notif.issuer.verified?.[0];
      const expiresAt = userVerifiedData?.expiresAt;
      const canExpire = !!(expiresAt ? new Date(expiresAt).getTime() : null);
      const expired =
        canExpire && expiresAt
          ? new Date().getTime() > new Date(expiresAt).getTime()
          : false;
      const isVerified = !!userVerifiedData && !expired;

      const verified: VerifiedUser = {
        verified: isVerified,
        type: userVerifiedData?.type || null,
        expiresAt: expiresAt ? new Date(expiresAt).getTime() : null,
      };

      const issuer: User = {
        id: notif.issuerId,
        username: notif.issuer.username,
        displayName: notif.issuer.displayName,
        avatarUrl: notif.issuer.avatarUrl || undefined,
        verified,
      };

      const comment = notif.comment
        ? {
            id: notif.comment.id,
            content: notif.comment.content,
            createdAt: notif.comment.createdAt.getTime(),
            author: null,
            postId: notif.comment.postId,
            postAuthorId: notif.comment.user.id,
            replies: 0,
            likes: 0,
            isLiked: false,
            isLikedByAuthor: false,
            isRepliedByAuthor: false,
          }
        : null;

      return {
        id: notif.id,
        type: notif.type,
        read: notif.read,
        issuer,
        recipientId: notif.recipientId,
        comment,
        createdAt: notif.createdAt.getTime(),
        postId: notif.postId || null,
        post: notif.post || null,
      };
    });

    const notificationsPage = {
      notifications: finalNotifications,
      cursor: nextCursor,
      hasMore: notifications.length > pageSize,
    };

    return res.json({
      success: true,
      message: "Notifications récupérées avec succès",
      data: notificationsPage,
    });
  } catch (error) {
    console.error(error);
    return res.json({
      success: false,
      message: "Erreur interne du serveur",
      name: "server-error",
      data: null,
    });
  }
}

export async function getUnreadNotificationCount(req: Request, res: Response) {
  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "invalid_session",
      });
    }

    const unreadCount = await prisma.notification.count({
      where: {
        recipientId: user.id,
        read: false,
      },
    });

    const data = {
      unreadCount,
    };

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);
    return res.json({
      success: false,
      message: "Quelque chose s'est mal passé. Veuillez réessayer.",
    });
  }
}
