// api/android/notifications
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import {
  ApiResponse,
} from "../../utils/dTypes";
import { getCurrentUser } from "../../auth/utils";

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

    await prisma.notification.updateMany({
      where: {
        recipientId: currentUserId,
        read: false,
      },
      data: {
        read: true,
      },
    });
    return NextResponse.json({
      success: true,
      message: "Toutes les notifications ont été marquées comme lues.",
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
