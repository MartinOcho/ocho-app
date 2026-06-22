import {
  authSessionManager,
  generateTokenId,
  generateUserId,
  github,
} from "@/auth";
import kyInstance from "@/lib/ky";
import prisma from "@/lib/prisma";
import { LocalUpload } from "@/lib/types";
import { slugify } from "@/lib/utils";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const cookieCall = await cookies()

  const storedState = cookieCall.get("state")?.value;

  if (!code || !state || !storedState || state !== storedState) {
    console.log(code, state, storedState);

    return new Response(null, { status: 400 });
  }

  try {
    // 🔑 Récupérer les infos du device depuis les cookies
    const deviceId = cookieCall.get("device_id")?.value;
    const deviceType = cookieCall.get("device_type")?.value;
    const deviceModel = cookieCall.get("device_model")?.value;
    
    console.warn("Device info from cookies:", { deviceId, deviceType, deviceModel });

    const tokens = await github.validateAuthorizationCode(code);

    const githubUser = await kyInstance
      .get("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${tokens.accessToken()}`,
        },
      })
      .json<{
        id: string;
        login: string;
        avatar_url: string;
        email?: string | null;
      }>();

    const githubId = githubUser.id.toString();
    const githubUsername = githubUser.login.toString();
    const githubAvatarUrl = githubUser.avatar_url;

    const existingUser = await prisma.user.findUnique({
      where: { githubId },
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
        userId: githubId,
        expiresAt: new Date(Date.now() + 600_000),
      },
    });

    if (existingUser) {
      const session = await authSessionManager.createSession(existingUser.id, {});
      
      // 🔑 Associer le deviceId à la session si disponible
      if (deviceId) {
        await prisma.session.update({
          where: { id: session.id },
          data: { deviceId }
        });
      }
      
      const sessionCookie = authSessionManager.createSessionCookie(session.id);

      cookieCall.set(
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes,
      );

      return new Response(null, {
        status: 302,
        headers: {
          Location: `/redirect?provider=github&userId=${githubId}&code=${authCode}`,
        },
      });
    }
    async function validatedUsername() {
      const baseUsername = slugify(githubUsername);
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
    cookieCall.delete("device_id");
    cookieCall.delete("device_type");
    cookieCall.delete("device_model");

    cookieCall.set(
      "oauth_pending",
      JSON.stringify({
        provider: "github",
        userId: githubId,
        email: githubUser.email ?? null,
        displayName: githubUsername,
        avatarUrl: githubAvatarUrl,
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
