// api/android/signup/route.ts

import { lucia } from "@/auth";
import prisma from "@/lib/prisma";
import { UserData } from "@/lib/types";
import { signupSchema, SignupValues } from "@/lib/validation";
import { hash } from "@node-rs/argon2";
import { VerifiedType, PrismaClient } from "@prisma/client";
import { generateIdFromEntropySize, User } from "lucia";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { deleteOldSessionsForAccountOnDevice } from "@/lib/session-utils";
import { detectGeoLocationFromIP } from "@/lib/geolocation-utils";
import { ApiResponse, UserSession, DeviceType } from "../utils/dTypes";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json(); // Récupérer et parser le corps de la requête
    const credentials: SignupValues = signupSchema.parse(body);
    const { username, email, password } = credentials;

    const passwordHash = await hash(password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    const userId = generateIdFromEntropySize(10);

    const existingUsername = await prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: "insensitive",
        },
      },
    });

    if (existingUsername) {
      return NextResponse.json(
        {
          success: false,
          message: "Ce nom d'utilisateur est déjà pris",
          name: "username",
        },
        
      );
    }

    const existingEmail = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
    });

    if (existingEmail) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Cette adresse email est déjà enregistrée. Voulez-vous vous connecter ?",
          name: "email",
        },
        
      );
    }

    const userData = await prisma.user.create({
      data: {
        id: userId,
        username,
        displayName: username,
        email,
        passwordHash,
      },
    });

    const session = await lucia.createSession(userId, {});
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
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

    // Vérifier si l'appareil existe déjà ou le créer
    if (deviceId && deviceTypeHeader) {
      // Récupérer la géolocalisation basée sur l'IP
      const geoLocation = await detectGeoLocationFromIP(ip, req.headers as any);

      let device = await prisma.device.findUnique({
        where: { deviceId: deviceId },
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
          where: { deviceId: deviceId },
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
      // (généralement pas de sessions anciennes pour une signup, mais par cohérence)
      await deleteOldSessionsForAccountOnDevice(userId, deviceId, session.id);
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
        verified: false,
        type: null,
        expiresAt: null,
      },
    };

    return NextResponse.json(
      {
        success: true,
        message: "Inscription réussie",
        data: {
          user,
          session,
        },
      } as ApiResponse<UserSession>
      
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        success: false,
        message: "Quelque chose s'est mal passé. Veuillez réessayer.",
      },
      
    );
  }
}
