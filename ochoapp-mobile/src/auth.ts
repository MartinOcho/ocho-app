import type { IncomingHttpHeaders } from "http";
import { Request, Response } from "express";
import prisma from "./prisma";
import { getUserDataSelect, User, UserData, VerifiedUser } from "./types";
import {
  loginSchema,
  sessionSchema,
  SessionValues,
  signupSchema,
} from "./validation";
import { verify, hash } from "@node-rs/argon2";
import { randomUUID } from "crypto";
import { upSaveDevice } from "./devices";
import { DeviceType } from "@prisma/client";
import { OAuth2Client } from "google-auth-library";
import { slugify } from "./utils";

type UserResponseData = Pick<
  UserData,
  "id" | "username" | "displayName" | "avatarUrl" | "bio" | "createdAt" | "lastSeen"
> & {
  verified?: Array<{
    type: string | null;
    expiresAt: Date | null;
  }>;
};

export function checkVerification(userData: UserResponseData): VerifiedUser {
  const userVerifiedData = userData.verified?.[0];
  const expiresAt = userVerifiedData?.expiresAt?.getTime() || null;
  const canExpire = !!(expiresAt || null);

  const expired =
    canExpire && expiresAt ? new Date().getTime() > expiresAt : false;

  const isVerified = !!userVerifiedData && !expired;

  const verified: VerifiedUser = {
    verified: isVerified,
    type: userVerifiedData?.type || null,
    expiresAt,
  };
  return verified;
}

export async function formatUserResponse(userData: UserResponseData): Promise<User> {
  const verified = await checkVerification(userData);
  const user: User = {
    id: userData.id,
    username: userData.username,
    displayName: userData.displayName,
    avatarUrl: userData.avatarUrl || undefined,
    bio: userData.bio || undefined,
    createdAt: userData.createdAt.getTime(),
    lastSeen: userData.lastSeen.getTime(),
    verified,
  };
  return user;
}

export async function loginUser(req: Request, res: Response) {
  const input = req.body;
  console.log(req.headers);

  const credentials = loginSchema.parse(input);
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
    return res.json({
      success: false,
      message: "invalid_credentials",
      name: "username",
      error: "Username or password incorrect",
    });
  }

  const validPassword = await verify(existingUser.passwordHash, password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });
  if (!validPassword) {
    return res.json({
      success: false,
      message: "invalid_credentials",
      name: "username",
      error: "Username or password incorrect",
    });
  }

  const user = await formatUserResponse(existingUser);

  // Créer une nouvelle session
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours

  const session = await prisma.session.create({
    data: {
      id: sessionId,
      userId: existingUser.id,
      expiresAt,
    },
  });

  const newSessionData = await newSession(
    existingUser.id,
    {
      deviceId: req.headers["x-device-id"] as string,
      deviceType: req.headers["x-device-type"] as string,
      deviceModel: req.headers["x-device-model"] as string,
    },
    (req.headers["x-forwarded-for"] as string) ||
      (req.headers["x-real-ip"] as string) ||
      "unknown",
  );

  if (!newSessionData.success) {
    console.warn(
      "Erreur lors de la création de la session:",
      newSessionData.message,
    );
    return res.json(newSessionData);
  }

  // Essayer de gérer le device et associer la session si les headers sont présents
  try {
    const deviceId = req.headers["X-Device-ID"] as string;
    if (deviceId) {
      await upSaveDevice(req.headers, existingUser.id, sessionId);
    }
  } catch (error) {
    console.warn("Erreur lors de la gestion du device:", error);
    // Ne pas échouer si la gestion du device échoue
  }

    return res.json({
      success: true,
      message: "auth_success",
      name: "AuthenticationSuccess",
      error: null,
      data: {
        user,
        session: {
          id: session.id,
          userId: session.userId,
          expiresAt: session.expiresAt.getTime(),
        },
      },
    });
}

export async function handleGoogleNativeLogin(req: Request, res: Response) {
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  const { idToken, deviceId } = req.body;

  try {
    // 1. Vérifier le token avec Google
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      return res.json({
        success: false,
        message: "google_auth_failed",
        name: "google_auth_error",
        error: "Google payload is empty",
      });
    }

    const { sub: googleId } = payload;

    // 2. Vérifier si l'utilisateur existe déjà
    let user = await prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      return res.json({
        success: true,
        isNewUser: true,
        message: "Nouvel utilisateur détecté.",
      });
    }

    // 3. Utilisateur existant : Créer la session
    const sessionResponse = await newSession(
      user.id,
      {
        deviceId: deviceId || (req.headers["x-device-id"] as string) || "",
        deviceType: (req.headers["x-device-type"] as string) || "ANDROID",
        deviceModel: req.headers["x-device-model"] as string,
      },
      (req.headers["x-forwarded-for"] as string) ||
        (req.headers["x-real-ip"] as string) ||
        "unknown",
    );

    if (!sessionResponse.success) {
      return res.json(sessionResponse);
    }

    const userResponse = await formatUserResponse(user);

    return res.json({
      success: true,
      message: "auth_success",
      data: {
        user: userResponse,
        session: sessionResponse.data?.session,
      },
    });
  } catch (error) {
    console.error("Google Login Error:", error);
    res.json({
      success: false,
      message: "google_auth_failed",
      name: "google_auth_error",
      error: "An error occurred during Google authentication",
    });
  }
}

export async function handleCompleteGoogleProfile(req: Request, res: Response) {
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  const { idToken, username, displayName, email, deviceId } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      return res.json({
        success: false,
        message: "google_session_expired",
        name: "google_session_expired",
        error: "Google session has expired",
      });
    }

    const { sub: googleId, picture } = payload;

    // 2. Vérifier si le username est disponible
    const existingUser = await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
    });

    if (existingUser) {
      return res.json({
        success: false,
        message: "username_taken",
        name: "username",
        error: "Username already exists",
      });
    }

    // 3. Créer l'utilisateur en base de données
    const userData = await prisma.user.create({
      data: {
        username,
        displayName: displayName || username,
        email: email || payload.email,
        googleId,
        avatarUrl: picture,
      },
    });

    const sessionResponse = await newSession(
      userData.id,
      {
        deviceId: deviceId || (req.headers["x-device-id"] as string) || "",
        deviceType: (req.headers["x-device-type"] as string) || "UNKNOWN",
        deviceModel: req.headers["x-device-model"] as string,
      },
      (req.headers["x-forwarded-for"] as string) ||
        (req.headers["x-real-ip"] as string) ||
        "unknown",
    );

    if (!sessionResponse.success) {
      return res.json(sessionResponse);
    }

    const userResponse = await formatUserResponse(userData);

    return res.json({
      success: true,
      message: "account_created",
      data: {
        user: userResponse,
        session: sessionResponse.data?.session,
      },
    });
  } catch (error) {
    console.error("Complete Profile Error:", error);
    res.json({
      success: false,
      message: "account_creation_failed",
      name: "complete_profile_error",
      error: "Failed to create user account from google profile",
    });
  }
}

async function validatedUsername(username: string): Promise<string> {
  const baseUsername = slugify(username);
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

export async function signupUser(req: Request, res: Response) {
  try {
    const input = req.body;
    const credentials = signupSchema.parse(input);
    const { username, email, password } = credentials;

    const passwordHash = await hash(password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    const userId = randomUUID();

    const existingUsername = await prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: "insensitive",
        },
      },
    });

    if (existingUsername) {
      return res.json({
        success: false,
        message: "username_taken",
        name: "username",
        error: "Username already exists",
      });
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
      return res.json({
        success: false,
        message: "email_taken",
        name: "email",
        error: "Email already registered",
      });
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

    // Créer une nouvelle session
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const newSessionData = await newSession(
      userData.id,
      {
        deviceId: req.headers["x-device-id"] as string,
        deviceType: req.headers["x-device-type"] as string,
        deviceModel: req.headers["x-device-model"] as string,
      },
      (req.headers["x-forwarded-for"] as string) ||
        (req.headers["x-real-ip"] as string) ||
        "unknown",
    );

    if (!newSessionData.success || !newSessionData.data?.session) {
      console.warn(
        "Erreur lors de la création de la session:",
        newSessionData.message,
      );
      return res.json(newSessionData);
    }
    const session = newSessionData.data.session;
    try {
      const deviceId = req.headers["X-Device-ID"] as string;
      if (deviceId) {
        await upSaveDevice(req.headers, userData.id, sessionId);
      }
    } catch (error) {
      console.warn("Erreur lors de la gestion du device:", error);
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

    return res.json({
      success: true,
      message: "auth_success",
      name: "username",
      error: null,
      data: {
        user,
        session: {
          id: session.id,
          userId: session.userId,
          deviceId: session.deviceId,
          expiresAt: session.expiresAt,
        },
      },
    });
  } catch (error) {
    console.error(error);
    return res.json({
      success: false,
      message: "server_error",
      name: "server_error",
      error: "Something went wrong during signup",
    });
  }
}
export async function newSession(
  userId: string,
  device: { deviceId: string; deviceType: string; deviceModel?: string },
  ip: string,
) {
  console.log(device, ip);

  try {
    const { deviceId, deviceType: deviceTypeHeader, deviceModel } = device;
    // Vérifier la présence des en-têtes essentiels
    if (!deviceId || !device) {
      return {
        success: false,
        message: "missing_device_headers",
        name: "missing_device_headers",
        error: "Device headers missing",
      };
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        id: {
          equals: userId,
          mode: "insensitive",
        },
      },
      select: getUserDataSelect(""),
    });

    if (!existingUser) {
      return {
        success: false,
        message: "invalid_session",
        name: "invalid_session",
        error: "User not found for session creation",
      };
    }

    let session;

    session = await prisma.session.findFirst({
      where: {
        userId,
        device: {
          deviceId,
        },
      },
    });

    let newDevice = await prisma.device.findUnique({
      where: {
        deviceId,
      },
    });

    if (!newDevice) {
      newDevice = await prisma.device.create({
        data: {
          deviceId,
          type: (deviceTypeHeader || "UNKNOWN") as DeviceType,
          model: deviceModel,
        },
      });
    }

    if (session) {
      // Mettre à jour la date d'expiration de la session existante
      const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      session = await prisma.session.update({
        where: {
          id: session.id,
        },
        data: {
          expiresAt: newExpiresAt,
        },
      });
    } else {
      // Créer une nouvelle session
      const sessionId = randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours
      session = await prisma.session.create({
        data: {
          id: sessionId,
          userId: existingUser.id,
          deviceId: newDevice.deviceId,
          expiresAt,
        },
      });
    }

    const user = await formatUserResponse(existingUser);

    return {
      success: true,
      message: "session_created",
      data: {
        user,
        session: {
          id: session.id,
          userId: session.userId,
          deviceId: session.deviceId,
          expiresAt: session.expiresAt.getTime(),
        },
      },
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      message: "server_error",
      name: "server_error",
      error: "Error during session creation",
    };
  }
}
export async function createSession(req: Request, res: Response) {
  try {
    const { id, userId } = req.body;

    // Récupérer les informations de l'appareil depuis les en-têtes
    const deviceId = req.headers["X-Device-ID"] as string;
    const deviceTypeHeader = req.headers["X-Device-Type"] as string;
    const deviceModel = req.headers["X-Device-Model"] as string;
    const ip =
      (req.headers["X-Forwarded-For"] as string) ||
      (req.headers["X-Real-Ip"] as string) ||
      "unknown";

    // Vérifier la présence des en-têtes essentiels
    if (!deviceId || !deviceTypeHeader) {
      return res.json({
        success: false,
        message: "missing_device_headers",
        name: "missing_device_headers",
        error: "Device headers missing (X-Device-ID, X-Device-Type)",
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        id: {
          equals: userId,
          mode: "insensitive",
        },
      },
      select: getUserDataSelect(""),
    });

    if (!existingUser) {
      return res.json({
        success: false,
        message: "invalid_session",
        name: "invalid_session",
        error: "User not found for session validation",
      });
    }

    let session;

    session = await prisma.session.findFirst({
      where: {
        userId,
        device: {
          deviceId,
        },
      },
    });

    let device = await prisma.device.findUnique({
      where: {
        deviceId,
      },
    });

    if (!device) {
      device = await prisma.device.create({
        data: {
          deviceId,
          type: (deviceTypeHeader || "UNKNOWN") as DeviceType,
          model: deviceModel,
        },
      });
    }

    if (session) {
      // Mettre à jour la date d'expiration de la session existante
      const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      session = await prisma.session.update({
        where: {
          id: session.id,
        },
        data: {
          expiresAt: newExpiresAt,
        },
      });
    } else {
      // Créer une nouvelle session
      const sessionId = randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours
      session = await prisma.session.create({
        data: {
          id: sessionId,
          userId: existingUser.id,
          deviceId: device.id,
          expiresAt,
        },
      });
    }

    // Créer une nouvelle session
    const sessionId = session.id;

    // Essayer de gérer le device et associer la session
    try {
      if (deviceId) {
        // upSaveDevice gère: la suppression des anciennes sessions, la création/mise à jour du device, et l'association de la session
        await upSaveDevice(req.headers, existingUser.id, sessionId);
      }
    } catch (error) {
      console.warn("Erreur lors de la gestion du device:", error);
    }

    const user = await formatUserResponse(existingUser);

    return res.json({
      success: true,
      message: "session_validated",
      data: {
        user,
        session: {
          id: session.id,
          userId: session.userId,
          expiresAt: session.expiresAt.getTime(),
        },
      },
    });
  } catch (error) {
    console.error(error);
    return res.json({
      success: false,
      message: "server_error",
      name: "server_error",
      error: "Something went wrong during signup",
    });
  }
}

export async function logoutUser(req: Request, res: Response) {
  const authHeader = req.headers["authorization"] as string | undefined;
  const deviceId = req.headers["x-device-id"] as string | undefined;

  const sessionToken = authHeader?.split(" ")[1];
  if (!sessionToken || !deviceId) {
    return res.json({
      success: false,
      message: "missing_credentials",
      name: "missing_credentials",
      error: "Missing session token or device ID",
    });
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionToken },
      select: { id: true, deviceId: true, userId: true },
    });

    if (!session || session.deviceId !== deviceId) {
      return res.json({
        success: false,
        message: "invalid_session",
        name: "invalid_session",
        error: "Session not found or device mismatch",
      });
    }

    await prisma.session.delete({ where: { id: sessionToken } });

    return res.json({
      success: true,
      message: "Successfully logged out",
      data: { sessionId: sessionToken, deviceId },
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.json({
      success: false,
      message: "logout_failed",
      name: "logout_error",
      error: "Logout process failed",
    });
  }
}

export async function getCurrentUser(
  headers: IncomingHttpHeaders,
): Promise<{ user: User | null; message: string }> {
  const headersList = headers;
  const getHeader = (name: string) => {
    const value = headersList[name.toLowerCase() as keyof IncomingHttpHeaders];
    return Array.isArray(value) ? value[0] : value;
  };

  const authHeader = getHeader("authorization");
  const sessionToken = authHeader?.split(" ")[1];

  if (!sessionToken) {
    return { user: null, message: "no_session_token" };
  }
  const session = await prisma.session.findUnique({
    where: {
      id: sessionToken,
    },
    include: {
      device: {
        select: {
          deviceId: true,
          type: true,
          model: true,
        },
      },
      user: { select: getUserDataSelect("") },
    },
  });
  if (!session?.user) {
    return { user: null, message: "invalid_session" };
  }
  // 1. Récupérer les informations de l'appareil à partir des en-têtes
  const deviceId = getHeader("x-device-id");
  const deviceTypeHeader = getHeader("x-device-type");
  // 2. Vérifier la présence des en-têtes essentiels pour l'appareil
  if (!deviceId || !deviceTypeHeader) {
    return { user: null, message: "missing_device_headers" };
  }

  // 3. Vérifier que le device existe et que la session est associée au device
  const device = await prisma.device.findUnique({
    where: {
      deviceId,
    },
  });

  // Vérifier que la session appartient au device
  if (!device || device.deviceId !== deviceId) {
    console.log(
      session,
      device,
      deviceId,
      "Session ou appareil non trouvé, ou session non associée à l'appareil",
    );

    return {
      user: null,
      message: "invalid_device_or_session",
    };
  }
  const userVerifiedData = session.user.verified?.[0];
  const expiresAt = userVerifiedData?.expiresAt?.getTime() || null;
  const canExpire = !!(expiresAt || null);

  const expired =
    canExpire && expiresAt ? new Date().getTime() > expiresAt : false;

  const isVerified = !!userVerifiedData && !expired;

  const verified: VerifiedUser = {
    verified: isVerified,
    type: userVerifiedData?.type,
    expiresAt,
  };
  const user: User = {
    id: session.user.id,
    username: session.user.username,
    displayName: session.user.displayName,
    avatarUrl: session.user.avatarUrl,
    verified,
    bio: session.user.bio,
    createdAt: session.user.createdAt.getTime(),
    lastSeen: session.user.lastSeen.getTime(),
  };
  return { user, message: "auth_success" };
}
