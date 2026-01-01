import prisma from "@/lib/prisma";
import { sessionSchema, SessionValues } from "@/lib/validation";
import { lucia } from "@/auth";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ApiResponse, UserSession } from "../utils/dTypes";
import { DeviceType } from "../utils/dTypes";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionCredentials: SessionValues = sessionSchema.parse(body);
    const { id, userId } = sessionCredentials;

    // Récupérer les informations de l'appareil depuis les en-têtes
    const deviceId = req.headers.get("X-Device-ID");
    const deviceTypeHeader = req.headers.get("X-Device-Type");
    const deviceModel = req.headers.get("X-Device-Model");

    // Vérifier la présence des en-têtes essentiels
    if (!deviceId || !deviceTypeHeader) {
      return NextResponse.json({
        success: false,
        message: "En-têtes d'appareil manquants (X-Device-ID, X-Device-Type).",
        name: "missing_device_headers",
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        id: {
          equals: userId,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        email: true,
        bio: true,
        createdAt: true,
        lastSeen: true,
        verified: {
          select: {
            type: true,
            expiresAt: true,
          },
        },
        passwordHash: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json({
        success: false,
        message: "Session non valide. Veuillez vous reconnecter et réessayer",
        name: "invalid_session",
      });
    }

    const userData = existingUser;
    const session = await lucia.createSession(existingUser.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);

    const cookieCall = await cookies()

    cookieCall.set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes,
    );

    // Vérifier si l'appareil existe déjà
    let device = await prisma.device.findFirst({
      where: { deviceId },
    });

    if (!device) {
      // Si l'appareil n'existe pas, le créer
      device = await prisma.device.create({
        data: {
          sessionId: session.id,
          deviceId: deviceId,
          type: (deviceTypeHeader as DeviceType) || "UNKNOWN",
          model: deviceModel || "Unknown Model",
        },
      });
      console.log("Nouvel appareil enregistré:", device);
    } else {
      // Si l'appareil existe, mettre à jour sa session pour la nouvelle connexion
      device = await prisma.device.update({
        where: { id: device.id },
        data: { sessionId: session.id, logged: true },
      });
      console.log("Appareil existant mis à jour:", device);
    }

    const user = {
      id: userData.id,
      username: userData.username,
      displayName: userData.displayName,
      email: userData.email,
      avatarUrl: userData.avatarUrl,
      bio: userData.bio,
      createdAt: userData.createdAt.getTime(),
      lastSeen: userData.lastSeen.getTime(),
      verified: {
        verified: !!userData.verified?.[0],
        type: userData.verified?.[0]?.type,
        expiresAt: userData.verified?.[0]?.expiresAt,
      },
    };

    return NextResponse.json({
      success: true,
      message: "Session validée avec succès.",
      data: {
        user,
        session,
      },
    } as ApiResponse<UserSession>);
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      success: false,
      message: "Quelque chose s'est mal passé. Veuillez réessayer.",
      name: "server_error",
    });
  }
}
