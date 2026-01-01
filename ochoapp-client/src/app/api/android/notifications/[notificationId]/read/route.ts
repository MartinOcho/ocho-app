// api/android/notifications
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import {
  ApiResponse,
} from "../../../utils/dTypes";
import { getCurrentUser } from "../../../auth/utils";

export async function POST(req: NextRequest, { params }: { params: Promise<{ notificationId: string }> }) {
  const { notificationId } = await params;
  try {
    const { user, message } = await getCurrentUser();
    if (!user) {
      return NextResponse.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      } as ApiResponse<null>);
    }

    const currentUserId = user.id

    const notification = await prisma.notification.findUnique({
      where: {
        id: notificationId,
        recipientId: currentUserId,
      },
    });
    if (!notification) {
      return NextResponse.json({
        success: false,
        message: "Notification non trouvée ou accès refusé.",
        name: "not_found",
      } as ApiResponse<null>);
    }
      await prisma.notification.update({
      where: {
        id: notificationId,
      },
      data: {
        read: true,
      },
    });
    return NextResponse.json({
      success: true,
      message: "Notification marquée comme lue.",
      data: null,
    } as ApiResponse<null>);
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
