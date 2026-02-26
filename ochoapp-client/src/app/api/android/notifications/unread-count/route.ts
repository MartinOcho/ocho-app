// api/android/notifications/check
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import {
  ApiResponse,
} from "../../utils/dTypes";
import { getCurrentUser } from "../../auth/utils";
import { NotificationCountInfo } from "@/lib/types";

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
    
        const unreadCount = await prisma.notification.count({
            where: {
                recipientId: user.id,
                read: false,
            }
        });

        const data: NotificationCountInfo = {
            unreadCount
        }

    return NextResponse.json({
      success: true,
      data,
    } as ApiResponse<NotificationCountInfo>);
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      success: false,
      message: "Quelque chose s'est mal passé. Veuillez réessayer.",
    } as ApiResponse<null>);
  }
}
