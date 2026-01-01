import prisma from "@/lib/prisma";
import { loginSchema, LoginValues } from "@/lib/validation";
import { verify } from "@node-rs/argon2";
import { lucia } from "@/auth";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  ApiResponse,
  User,
  UserSession,
  DeviceType,
  VerifiedUser,
} from "../utils/dTypes";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json(); // Récupérer et parser le corps de la requête
    const credentials: LoginValues = loginSchema.parse(body);
    const { username, password } = credentials;

    const existingUser = await prisma.user.findFirst({
      where: {
        username: {
          equals: username,
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

    if (!existingUser || !existingUser.passwordHash) {
      return NextResponse.json({
        success: false,
        message:
          "Nom d'utilisateur ou mot de passe incorrect. Verifiez vos informations",
      });
    }

    const validPassword = await verify(existingUser.passwordHash, password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    if (!validPassword) {
      return NextResponse.json({
        success: false,
        message:
          "Nom d'utilisateur ou mot de passe incorrect. Verifiez vos informations",
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

    // Vérifier si l'appareil existe déjà
    let device = await prisma.device.findFirst({
      where: { deviceId: deviceId },
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
