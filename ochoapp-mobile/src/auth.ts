import type { IncomingHttpHeaders } from "http";
import { Request, Response } from "express";
import prisma from "./prisma";
import { User, UserData, VerifiedUser } from "./types";
import { loginSchema, sessionSchema, SessionValues, signupSchema } from "./validation";
import { verify, hash } from "@node-rs/argon2";
import { randomUUID } from "crypto";
import { upSaveDevice } from "./devices";

export async function checkVerification(
  userData: UserData,
): Promise<VerifiedUser> {
  const userVerifiedData = userData.verified?.[0];
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
  return verified;
}

export async function formatUserResponse(userData: UserData): Promise<User> {
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
      message: "Nom d'utilisateur ou mot de passe incorrect.",
      name: "AuthenticationError",
      error: null,
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
      message: "Nom d'utilisateur ou mot de passe incorrect.",
      name: "AuthenticationError",
      error: null,
    });
  }

  const user = await formatUserResponse(existingUser as unknown as UserData);
  
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

  // Essayer de gérer le device et associer la session si les headers sont présents
  try {
    const deviceId = req.headers["X-Device-ID"] as string;
    if (deviceId) {
      // upSaveDevice gère: la suppression des anciennes sessions, la création/mise à jour du device, et l'association de la session
      await upSaveDevice(req.headers, existingUser.id, sessionId);
    }
  } catch (error) {
    console.warn("Erreur lors de la gestion du device:", error);
    // Ne pas échouer si la gestion du device échoue
  }

  return res.json({
    success: true,
    message: "Authentification réussie.",
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
        message: "Ce nom d'utilisateur est déjà pris",
        name: "username",
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
        message:
          "Cette adresse email est déjà enregistrée. Voulez-vous vous connecter ?",
        name: "email",
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
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours
    
    const session = await prisma.session.create({
      data: {
        id: sessionId,
        userId: userData.id,
        expiresAt,
      },
    });

    // Essayer de gérer le device et associer la session si les headers sont présents
    try {
      const deviceId = req.headers["X-Device-ID"] as string;
      if (deviceId) {
        // upSaveDevice gère: la suppression des anciennes sessions, la création/mise à jour du device, et l'association de la session
        await upSaveDevice(req.headers, userData.id, sessionId);
      }
    } catch (error) {
      console.warn("Erreur lors de la gestion du device:", error);
      // Ne pas échouer si la gestion du device échoue
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
      message: "Inscription réussie",
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
      message: "Quelque chose s'est mal passé. Veuillez réessayer.",
      name: "server_error",
    });
  }
}
export async function createSession(req: Request, res: Response) {
  try {
    const { id, userId } = req.body;

    // Récupérer les informations de l'appareil depuis les en-têtes
    const deviceId = req.headers["X-Device-ID"] as string;
    const deviceTypeHeader = req.headers["X-Device-Type"] as string;
    const deviceModel = req.headers["X-Device-Model"] as string;
    const ip = req.headers["X-Forwarded-For"] as string || req.headers["X-Real-Ip"] as string || "unknown";

    // Vérifier la présence des en-têtes essentiels
    if (!deviceId || !deviceTypeHeader) {
      return res.json({
        success: false,
        message: "En-têtes d'appareil manquants (X-Device-ID, X-Device-Type).",
        name: "missing_device_headers",
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        id: {
          equals: userId,
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


    if (!existingUser) {
      return res.json({
        success: false,
        message: "Session non valide. Veuillez vous reconnecter et réessayer",
        name: "invalid_session",
      });
    }

    let session;

    session = await prisma.session.findFirst({
      where: {
        userId,
        deviceId,
      },
    });

    if (session){
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
    }else{
      // Créer une nouvelle session
      const sessionId = randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours
      session = await prisma.session.create({
        data: {
          id: sessionId,
          userId: existingUser.id,
          deviceId,
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

    const user = await formatUserResponse(existingUser as unknown as UserData);

    return res.json({
      success: true,
      message: "Session validée avec succès.",
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
      message: "Quelque chose s'est mal passé. Veuillez réessayer.",
      name: "server_error",
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
      message: "Missing session token or device ID",
      name: "missing_credentials",
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
        message: "Session not found or device mismatch",
        name: "invalid_session",
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
      message: "Logout failed",
      name: "logout_error",
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
    return { user: null, message: "Pas de token de session trouvé" };
  }
  const session = await prisma.session.findUnique({
    where: {
      id: sessionToken,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
          lastSeen: true,
          createdAt: true,
          following: {
            select: {
              followerId: true,
            },
            take: 0,
          },
          followers: {
            select: {
              followerId: true,
            },
            take: 0,
          },
          verified: true,
          _count: true,
        },
      },
    },
  });
  if (!session?.user) {
    return { user: null, message: "Token de session invalide" };
  }
  // 1. Récupérer les informations de l'appareil à partir des en-têtes
  const deviceId = getHeader("x-device-id");
  const deviceTypeHeader = getHeader("x-device-type");
  // 2. Vérifier la présence des en-têtes essentiels pour l'appareil
  if (!deviceId || !deviceTypeHeader) {
    return { user: null, message: "Pas d'en-têtes d'appareil trouvés." };
  }

  // 3. Vérifier que le device existe et que la session est associée au device
  const device = await prisma.device.findUnique({
    where: {
      deviceId,
    },
  });

  // Vérifier que la session appartient au device
  if (!device || session.deviceId !== deviceId) {
    return {
      user: null,
      message: "Appareil non autorisé ou session invalide.",
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
  return { user, message: "Utilisateur authentifié." };
}
