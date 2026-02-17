import { lucia } from "@/auth";
import kyInstance from "@/lib/ky";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { google } from "@/app/(mobile)/android/auth";
import { generateId, generateIdFromEntropySize } from "lucia";
import { slugify } from "@/lib/utils";
import { deleteOldSessionsForAccountOnDevice } from "@/lib/session-utils";
import { detectGeoLocationFromIP } from "@/lib/geolocation-utils";
import { DeviceType } from "../../utils/dTypes";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieCall = await cookies()

  const storedState = cookieCall.get("state")?.value;
  const storedCodeVerifier = cookieCall.get("code_verifier")?.value;

  if (
    !code ||
    !state ||
    !storedState ||
    !storedCodeVerifier ||
    state !== storedState
  ) {
    return new Response(null, { status: 400 });
  }

  try {
    const tokens = await google.validateAuthorizationCode(
      code,
      storedCodeVerifier,
    );

    const googleUser = await kyInstance
      .get("https://www.googleapis.com/oauth2/v1/userinfo/", {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      })
      .json<{ id: string; name: string; email: string; picture: string | null }>();

    console.log(googleUser);
    

    const deviceId = req.headers.get("X-Device-ID");
    const deviceTypeHeader = req.headers.get("X-Device-Type");
    const deviceModel = req.headers.get("X-Device-Model");

    const existingUser = await prisma.user.findUnique({
      where: { googleId: googleUser.id },
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
    const authCode = generateId(20);
    await prisma.authCode.create({
      data: {
        id: authCode,
        userId: googleUser.id,
        expiresAt: new Date(Date.now() + 600_000),
      },
    });

    if (existingUser) {
      const session = await lucia.createSession(existingUser.id, {});
      const sessionCookie = lucia.createSessionCookie(session.id);

      cookieCall.set(
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes,
      );

      // Gestion du device pour Android
      if (deviceId && deviceTypeHeader) {
        const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
        const geoLocation = await detectGeoLocationFromIP(ip, req.headers as any);

        let device = await prisma.device.findUnique({
          where: { deviceId: deviceId },
        });

        if (!device) {
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
        await deleteOldSessionsForAccountOnDevice(
          existingUser.id,
          deviceId,
          session.id,
        );
      }

      return new Response(null, {
        status: 302,
        headers: {
          Location: `/redirect?provider=google&userId=${googleUser.id}&code=${authCode}`,
        },
      });
    }

    const userId = generateIdFromEntropySize(10);

    async function validatedUsername() {
      const baseUsername = slugify(googleUser.name);
      let validatedUsername = baseUsername;

      // Chercher tous les noms d'utilisateur qui commencent par le nom de base
      const similarUsernames = await prisma.user.findMany({
        where: {
          username: {
            startsWith: baseUsername,
          },
        },
        select: { username: true },
      });

      if (similarUsernames.length === 0) {
        // Si aucun nom d'utilisateur similaire, le nom est disponible
        return validatedUsername;
      }

      // Extraire uniquement les suffixes numériques
      const usernameSet = new Set(similarUsernames.map((u) => u.username));
      let number = 1;

      // Trouver le premier suffixe disponible
      while (usernameSet.has(validatedUsername)) {
        validatedUsername = `${baseUsername}${number}`;
        number++;
      }

      return validatedUsername;
    }

    const username = await validatedUsername();
    const email = googleUser.email;
    const avatarUrl = await prisma.user.create({
      data: {
        id: userId,
        username,
        email,
        displayName: googleUser.name,
        googleId: googleUser.id,
      },
    });

    const session = await lucia.createSession(userId, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    cookieCall.set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes,
    );

    // Gestion du device pour Android
    if (deviceId && deviceTypeHeader) {
      const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
      const geoLocation = await detectGeoLocationFromIP(ip, req.headers as any);

      let device = await prisma.device.findUnique({
        where: { deviceId: deviceId },
      });

      if (!device) {
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
      await deleteOldSessionsForAccountOnDevice(userId, deviceId, session.id);
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: `/redirect?provider=google&userId=${googleUser.id}&code=${authCode}`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      success: false,
      message: "Quelque chose s'est mal passé. Veuillez réessayer.",
    });
  }
}
