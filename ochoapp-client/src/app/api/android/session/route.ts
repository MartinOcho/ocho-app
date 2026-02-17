import prisma from "@/lib/prisma";
import { sessionSchema, SessionValues } from "@/lib/validation";
import { lucia } from "@/auth";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { deleteOldSessionsForAccountOnDevice } from "@/lib/session-utils";
import { detectGeoLocationFromIP } from "@/lib/geolocation-utils";
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
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

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

    // Récupérer la géolocalisation basée sur l'IP
    const geoLocation = await detectGeoLocationFromIP(ip, req.headers as any);

    // Vérifier si l'appareil existe déjà
    let device = await prisma.device.findUnique({
      where: { deviceId },
    });

    if (!device) {
      // Si l'appareil n'existe pas, le créer
      device = await prisma.device.create({
        data: {
          deviceId: deviceId,
          type: (deviceTypeHeader as DeviceType) || "UNKNOWN",
          model: deviceModel || "Unknown Model",
          ip: ip,
          location: geoLocation.city && geoLocation.countryCode 
            ? `${geoLocation.city}, ${geoLocation.countryCode}` 
            : geoLocation.countryCode || null,
        },
      });
      console.log("Nouvel appareil enregistré:", device);
    } else {
      // Mettre à jour l'IP et la localisation à chaque appel
      device = await prisma.device.update({
        where: { deviceId },
        data: {
          ip: ip,
          location: geoLocation.city && geoLocation.countryCode 
            ? `${geoLocation.city}, ${geoLocation.countryCode}` 
            : geoLocation.countryCode || device.location,
          updatedAt: new Date(),
        },
      });
    }

    // Associer la session au device
    await prisma.session.update({
      where: { id: session.id },
      data: { deviceId: deviceId },
    });
    console.log("Session associée au device:", session.id);

    // Supprimer les anciennes sessions de ce compte sur ce device
    await deleteOldSessionsForAccountOnDevice(
      existingUser.id,
      deviceId,
      session.id,
    );

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
