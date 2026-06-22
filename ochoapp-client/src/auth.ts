import NextAuth from "next-auth";
import { Facebook, GitHub, Google } from "arctic";
import { cache } from "react";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import prisma from "./lib/prisma";
import { getUserDataSelect } from "./lib/types";

const sessionCookieName =
  process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

const legacySessionCookieName = "auth_session";

const sessionCookieAttributes = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};

const sessionMaxAgeMs = 1000 * 60 * 60 * 24 * 30;

function isPrismaConnectionError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const message = error.message;
  const code = (error as { code?: string }).code;

  return (
    message.includes("ECONNREFUSED") ||
    message.includes("ETIMEDOUT") ||
    message.includes("EHOSTUNREACH") ||
    message.includes("Connection pool") ||
    code === "P1000" ||
    code === "P1001" ||
    code === "P1008" ||
    code === "P1011"
  );
}

export function generateUserId() {
  return randomBytes(15).toString("base64url");
}

export function generateTokenId(byteLength = 20) {
  return randomBytes(byteLength).toString("base64url");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [],
  session: { strategy: "database" },
  trustHost: true,
});

export const authSessionManager = {
  sessionCookieName,

  async createSession(userId: string, _attributes: Record<string, unknown>) {
    const id = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + sessionMaxAgeMs);

    return prisma.session.create({
      data: {
        id,
        userId,
        expiresAt,
      },
    });
  },

  createSessionCookie(sessionId: string) {
    return {
      name: sessionCookieName,
      value: sessionId,
      attributes: {
        ...sessionCookieAttributes,
        expires: new Date(Date.now() + sessionMaxAgeMs),
        maxAge: Math.floor(sessionMaxAgeMs / 1000),
      },
    };
  },

  createBlankSessionCookie() {
    return {
      name: sessionCookieName,
      value: "",
      attributes: {
        ...sessionCookieAttributes,
        expires: new Date(0),
        maxAge: 0,
      },
    };
  },

  async invalidateSession(sessionId: string) {
    await prisma.session.deleteMany({
      where: { id: sessionId },
    });
  },

  async validateSession(sessionId: string) {
    try {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.expiresAt <= new Date()) {
        if (session) {
          await this.invalidateSession(session.id);
        }
        return { user: null, session: null };
      }

      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: {
          ...getUserDataSelect(session.userId),
          birthday: true,
          lastUsernameChange: true,
        },
      });

      if (!user) {
        await this.invalidateSession(session.id);
        return { user: null, session: null };
      }

      return { user, session };
    } catch (error) {
      if (isPrismaConnectionError(error)) {
        return { user: null, session: null };
      }
      throw error;
    }
  },
};

export type AuthSession = Awaited<
  ReturnType<typeof authSessionManager.createSession>
>;

export type AuthUser = NonNullable<
  Awaited<ReturnType<typeof validateRequest>>["user"]
>;

export const google = new Google(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback/google`,
);

export const facebook = new Facebook(
  process.env.FACEBOOK_CLIENT_ID!,
  process.env.FACEBOOK_CLIENT_SECRET!,
  `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback/facebook`,
);

export const github = new GitHub(
  process.env.GITHUB_CLIENT_ID!,
  process.env.GITHUB_CLIENT_SECRET!,
`${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback/github`,
);

export const validateRequest = cache(async () => {
  const cookieStore = await cookies();
  const sessionId =
    cookieStore.get(sessionCookieName)?.value ??
    cookieStore.get(legacySessionCookieName)?.value ??
    null;

  if (!sessionId) return { user: null, session: null };

  const result = await authSessionManager.validateSession(sessionId);

  try {
    if (result.session) {
      const sessionCookie = authSessionManager.createSessionCookie(
        result.session.id,
      );
      cookieStore.set(
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes,
      );

      if (cookieStore.get(legacySessionCookieName)?.value) {
        cookieStore.delete(legacySessionCookieName);
      }
    } else {
      const sessionCookie = authSessionManager.createBlankSessionCookie();
      cookieStore.set(
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes,
      );
      cookieStore.delete(legacySessionCookieName);
    }
  } catch {}

  return result;
});
