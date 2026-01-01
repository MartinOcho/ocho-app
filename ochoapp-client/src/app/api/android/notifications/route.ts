// api/android/notifications
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import {
  ApiResponse,
  NotificationData,
  NotificationsPage,
  User,
  VerifiedUser,
  Comment,
} from "../utils/dTypes";
import { getCurrentUser } from "../auth/utils";

export async function GET(req: NextRequest) {
  try {
    const { user, message } = await getCurrentUser();
    if (!user) {
      return NextResponse.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      } as ApiResponse<null>);
    }
    const currentUserId = user.id;

    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
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

    const finalNotifications: NotificationData[] = notifications
      .slice(0, pageSize)
      .map((notif) => {
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
          // On renvoie un timestamp en millisecondes, pas une chaîne de caractères
          expiresAt: expiresAt ? new Date(expiresAt).getTime() : null,
        };

        const issuer: User = {
          id: notif.issuerId,
          username: notif.issuer.username,
          displayName: notif.issuer.displayName,
          avatarUrl: notif.issuer.avatarUrl || undefined,
          verified,
        };
        const comment: Comment | null = notif.comment
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
        };
      });

    const notificationsPage: NotificationsPage = {
      notifications: finalNotifications,
      cursor: nextCursor,
      hasMore: notifications.length > pageSize,
    };

    return NextResponse.json({
      success: true,
      message: "Notifications récupérées avec succès",
      data: notificationsPage,
    } as ApiResponse<NotificationsPage>);
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      success: false,
      message: "Erreur interne du serveur",
      name: "server-error",
      data: null,
    } as ApiResponse<null>);
  }
}
