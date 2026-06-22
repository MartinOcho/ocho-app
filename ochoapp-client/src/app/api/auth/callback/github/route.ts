import { github, authSessionManager } from "@/auth";
import kyInstance from "@/lib/ky";
import prisma from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { OAuth2RequestError } from "arctic";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  const cookieCall = await cookies();

  const storedState = cookieCall.get("state")?.value;
  const shouldKeepSwitching =
    cookieCall.get("oauth_switching")?.value === "true" ||
    cookieCall.get("oauth_switching")?.value === "1";

  if (!code || !state || !storedState || state !== storedState) {
    console.log(code, state, storedState);

    // Nettoyer les cookies avant de retourner l'erreur
    cookieCall.delete("state");
    cookieCall.delete("oauth_switching");

    return new Response(null, { status: 400 });
  }

  try {
    // 🔑 Récupérer les infos du device depuis les cookies (si disponible)
    const deviceId = cookieCall.get("device_id")?.value;
    
    console.warn("Device info from cookies:", { deviceId });

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

      // Nettoyer les cookies OAuth
      cookieCall.delete("state");
      cookieCall.delete("device_id");
      cookieCall.delete("device_type");
      cookieCall.delete("device_model");
      cookieCall.delete("oauth_switching");

      // Set custom cookie indicating third-party auth
      cookieCall.set("third_party_auth", "github", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });

      return new Response(null, {
        status: 302,
        headers: {
          Location: "/",
        },
      });
    }

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

    // Nettoyer les cookies OAuth et stocker les infos pour l'étape d'onboarding
    cookieCall.delete("state");
    cookieCall.delete("device_id");
    cookieCall.delete("device_type");
    cookieCall.delete("device_model");

    const onboardingRedirect = shouldKeepSwitching
      ? "/oauth-complete?switching=true"
      : "/oauth-complete";

    cookieCall.set(
      "oauth_pending",
      JSON.stringify({
        provider: "github",
        userId: githubId,
        email: githubUser.email ?? null,
        displayName: githubUsername,
        avatarUrl: githubAvatarUrl,
        usernameSuggestion: username,
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
        Location: onboardingRedirect,
      },
    });
  } catch (error) {
    console.error(error);

    // Nettoyer les cookies en cas d'erreur
    cookieCall.delete("state");
    cookieCall.delete("device_id");
    cookieCall.delete("device_type");
    cookieCall.delete("device_model");

    if (error instanceof OAuth2RequestError) {
      return new Response(null, {
        status: 400,
      });
    }
    return new Response(null, {
      status: 500,
    });
  }
}
