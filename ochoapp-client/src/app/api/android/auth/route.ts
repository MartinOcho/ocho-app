import { lucia } from "@/auth";
import prisma from "@/lib/prisma";
import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  User,
  ApiResponse,
  UserSession,
  DeviceType,
  VerifiedUser,
} from "../utils/dTypes";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  const user_id = req.nextUrl.searchParams.get("userId") || "";
  const code = req.nextUrl.searchParams.get("code") || "";

  // Récupérer les informations de l'appareil à partir des en-têtes
  const deviceId = req.headers.get("X-Device-ID");
  const deviceTypeHeader = req.headers.get("X-Device-Type");
  const deviceModel = req.headers.get("X-Device-Model");
  const deviceType = (deviceTypeHeader as DeviceType) || "UNKNOWN";

  // Vérifier la présence des en-têtes essentiels pour l'enregistrement de l'appareil
  if (!deviceId || !deviceTypeHeader) {
    return NextResponse.json({
      success: false,
      message: "En-têtes d'appareil manquants (X-Device-ID, X-Device-Type).",
      name: "missing_device_headers",
    });
  }

  const authCode = await prisma.authCode.findUnique({
    where: {
      id_userId: {
        id: code,
        userId: user_id,
      },
    },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
    },
  });

  if (!authCode) {
    return NextResponse.json({
      success: false,
      message: "Code d'authentification expiré ou invalide.",
      name: "invalid_auth_code",
    });
  }

  const isExpired = new Date() > new Date(authCode.expiresAt);
  await prisma.authCode.delete({
    where: {
      id_userId: {
        id: code,
        userId: user_id,
      },
    },
  });

  if (isExpired) {
    return NextResponse.json({
      success: false,
      message: "Code d'authentification expiré ou invalide.",
      name: "expired_auth_code",
    });
  }

  try {
    const wheres = {
      google: {
        where: { googleId: user_id },
      },
      github: {
        where: { githubId: user_id },
      },
    };

    const where = wheres[type as keyof typeof wheres].where;

    // Check if google or github user exists

    const existingUser = await prisma.user.findUnique({
      where,
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
        message: "Compte introuvable.",
        name: "user_not_found",
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

    // Vérifier si l'appareil existe déjà ou le créer
    let device = await prisma.device.findUnique({
      where: { deviceId: deviceId },
    });

    if (!device) {
      // Si l'appareil n'existe pas, le créer
      device = await prisma.device.create({
        data: {
          deviceId: deviceId,
          // Utiliser le type d'appareil de l'en-tête et caster l'enum
          type: deviceType,
          model: deviceModel || "Unknown Model",
        },
      });
      console.log("Nouvel appareil enregistré:", device);
    }

    // Associer la session au device
    await prisma.session.update({
      where: { id: session.id },
      data: { deviceId: deviceId },
    });
    console.log("Session associée au device:", session.id);
    const userVerifiedData = userData.verified?.[0];
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
    const user: User = {
      id: userData.id,
      username: userData.username,
      displayName: userData.displayName,
      email: userData.email || undefined,
      avatarUrl: userData.avatarUrl || undefined,
      bio: userData.bio || undefined,
      createdAt: userData.createdAt.getTime(),
      lastSeen: userData.lastSeen.getTime(),
      verified,
    };

    return NextResponse.json<ApiResponse<UserSession>>({
      success: true,
      message: "Connexion réussie",
      data: {
        user,
        session,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      success: false,
      message: "Quelque chose s'est mal passé. Veuillez réessayer.",
      name: "server_error",
    });
  }
}

