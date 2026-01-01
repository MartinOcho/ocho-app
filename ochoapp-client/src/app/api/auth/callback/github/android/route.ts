import { github, lucia } from "@/auth";
import kyInstance from "@/lib/ky";
import prisma from "@/lib/prisma";
import { LocalUpload } from "@/lib/types";
import { slugify } from "@/lib/utils";
import { generateId, generateIdFromEntropySize } from "lucia";
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
    const tokens = await github.validateAuthorizationCode(code);

    const githubUser = await kyInstance
      .get("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      })
      .json<{ id: string; login: string; avatar_url: string }>();

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

    const authCode = generateId(20);
    await prisma.authCode.create({
      data: {
        id: authCode,
        userId: githubId,
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

      return new Response(null, {
        status: 302,
        headers: {
          Location: `/redirect?provider=github&userId=${githubId}&code=${authCode}`,
        },
      });
    }
    const userId = generateIdFromEntropySize(10);

    async function validatedUsername() {
      const baseUsername = slugify(githubUsername);
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

    // Étape 1: Récupérer l'image de Facebook
    const avatarResponse = await kyInstance.get(githubAvatarUrl);
    const avatarBlob = await avatarResponse.blob();

    // Fonction pour uploader l'avatar via fetch
    async function uploadAvatar(blob: Blob): Promise<string | null> {
      const file = new File([blob], `avatar-${userId}.webp`, {
        type: "image/webp",
      });
      const formData = new FormData();
      formData.append("avatar", file);

      let response = await kyInstance
        .post("/api/upload/avatar", {
          body: formData,
          throwHttpErrors: false,
        })
        .json<LocalUpload[] | null>();

      if (!response?.[0]?.serverData?.avatarUrl) {
        response = await kyInstance
          .post("/api/uploadthing", {
            body: formData,
            throwHttpErrors: false,
          })
          .json<LocalUpload[] | null>();
        if (!response?.[0]?.serverData?.avatarUrl) {
          return null;
        }
      }
      const result = response[0].appUrl;
      return result;
    }

    const avatarUrl = await uploadAvatar(avatarBlob);

    await prisma.user.create({
      data: {
        id: userId,
        username,
        displayName: githubUsername,
        githubId,
        avatarUrl,
      },
    });

    const session = await lucia.createSession(userId, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
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
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      success: false,
      message: "Quelque chose s'est mal passé. Veuillez réessayer.",
    });
  }
}
