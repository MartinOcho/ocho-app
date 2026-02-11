import prisma from "@/lib/prisma";
import { DeliveryInfo } from "@/lib/types";
import { ApiResponse } from "../../../utils/dTypes";
import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../auth/utils";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const {messageId} = await params
  const { user: loggedInUser, message } = await getCurrentUser();
      if (!loggedInUser) {
          return NextResponse.json({
          success: false,
          message: message || "Utilisateur non authentifié.",
          name: "unauthorized",
          } as ApiResponse<null>);
      }
  try {

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        deliveries: {
          select: {
            user: {
              select: {
                id: true,
                displayName: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!message) {
        return NextResponse.json({
        success: false,
        message: "Message non trouvé.",
        name: "not-found",
        } as ApiResponse<null>);
    }

    const deliveries = message.deliveries.map((delivery) => delivery.user);

    const data: DeliveryInfo = {
      deliveries,
    };
    return NextResponse.json<ApiResponse<DeliveryInfo>>({ success: true, data });
  } catch (error) {
    console.error("Erreur lors de la récupération des livraisons du message :", error);
    return NextResponse.json({
      success: false,
      message: "Erreur interne du serveur",
      name: "server-error",
      data: null,
      error: error instanceof Error ? error.message : String(error),
    } as ApiResponse<null>);
  }
}
