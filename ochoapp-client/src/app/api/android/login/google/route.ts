import { authSessionManager, generateTokenId, generateUserId } from "@/auth";
import kyInstance from "@/lib/ky";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { google } from "@/app/(mobile)/android/auth";
import { slugify } from "@/lib/utils";
import { deleteOldSessionsForAccountOnDevice } from "@/lib/session-utils";
import { detectGeoLocationFromIP } from "@/lib/geolocation-utils";
import { DeviceType } from "@prisma/client";

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
          Authorization: `Bearer ${tokens.accessToken()}`,
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
    const authCode = generateTokenId(20);
    await prisma.authCode.create({
      data: {
        id: authCode,
        userId: googleUser.id,
        expiresAt: new Date(Date.now() + 600_000),
      },
    });

    if (existingUser) {
      const session = await authSessionManager.createSession(existingUser.id, {});
      const sessionCookie = authSessionManager.createSessionCookie(session.id);

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

    async function validatedUsername() {
      const baseUsername = slugify(googleUser.name);
      let validatedUsername = baseUsername;

      const similarUsernames = await prisma.user.findMany({
        where: {
          username: {
            startsWith: baseUsername,
          },
        },
        select: { username: true },
      });

      if (similarUsernames.length === 0) {
        return validatedUsername;
      }

      const usernameSet = new Set(similarUsernames.map((u) => u.username));
      let number = 1;

      while (usernameSet.has(validatedUsername)) {
        validatedUsername = `${baseUsername}${number}`;
        number++;
      }

      return validatedUsername;
    }

    const username = await validatedUsername();

    cookieCall.delete("state");
    cookieCall.delete("code_verifier");
    cookieCall.delete("device_id");
    cookieCall.delete("device_type");
    cookieCall.delete("device_model");

    cookieCall.set(
      "oauth_pending",
      JSON.stringify({
        provider: "google",
        userId: googleUser.id,
        email: googleUser.email,
        displayName: googleUser.name,
        avatarUrl: googleUser.picture ?? null,
        usernameSuggestion: username,
        authCode,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 5,
      },
    );

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/oauth-complete",
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
