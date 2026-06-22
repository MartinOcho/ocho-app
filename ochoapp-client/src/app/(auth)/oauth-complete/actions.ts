"use server";

import { authSessionManager, generateUserId } from "@/auth";
import prisma from "@/lib/prisma";
import { oauthCompleteSchema } from "@/lib/validation";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

interface CompleteOAuthAccountInput {
  provider: string;
  providerUserId: string;
  username: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
}

export async function completeOAuthAccount(
  input: CompleteOAuthAccountInput,
): Promise<{ error?: string }> {
  try {
    const validatedData = oauthCompleteSchema.parse({
      username: input.username,
      displayName: input.displayName,
    });

    const cookieStore = await cookies();
    const pendingCookie = cookieStore.get("oauth_pending")?.value;

    if (!pendingCookie) {
      return { error: "La session d'inscription a expiré. Veuillez recommencer." };
    }

    const pendingData = JSON.parse(pendingCookie);
    if (!pendingData || pendingData.provider !== input.provider || pendingData.userId !== input.providerUserId) {
      return { error: "Les informations d'authentification sont invalides." };
    }

    const existingUsername = await prisma.user.findFirst({
      where: {
        username: {
          equals: validatedData.username,
          mode: "insensitive",
        },
      },
    });

    if (existingUsername) {
      return { error: "Ce nom d'utilisateur est déjà pris." };
    }

    const existingEmail = input.email
      ? await prisma.user.findFirst({
          where: {
            email: {
              equals: input.email,
              mode: "insensitive",
            },
          },
        })
      : null;

    if (existingEmail) {
      return { error: "Cette adresse email est déjà utilisée." };
    }

    const userId = generateUserId();

    const userData = {
      id: userId,
      username: validatedData.username,
      displayName: validatedData.displayName,
      email: input.email || undefined,
      avatarUrl: input.avatarUrl || undefined,
      ...(input.provider === "google"
        ? { googleId: input.providerUserId }
        : { githubId: input.providerUserId }),
    };

    await prisma.user.create({ data: userData });

    const session = await authSessionManager.createSession(userId, {});
    const sessionCookie = authSessionManager.createSessionCookie(session.id);

    cookieStore.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    cookieStore.delete("oauth_pending");
    cookieStore.set("third_party_auth", input.provider, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });

    const redirectTarget = pendingData.authCode
      ? `/redirect?provider=${input.provider}&userId=${input.providerUserId}&code=${pendingData.authCode}`
      : "/";

    redirect(redirectTarget);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof Error && error.message.includes("Invalid JSON")) {
      return { error: "La session a expiré. Veuillez recommencer." };
    }

    return { error: "Une erreur est survenue lors de la création du compte." };
  }

  return { error: "Une erreur est survenue lors de la création du compte." };
}
