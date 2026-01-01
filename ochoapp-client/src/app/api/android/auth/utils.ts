import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { User, VerifiedUser } from "../utils/dTypes";

export async function getCurrentUser():Promise<{user: User | null; message: string}> {
  const headersList = await headers();
   const authHeader = headersList.get("Authorization");
  const sessionToken = authHeader?.split(" ")[1];
  
  if (!sessionToken) {
    return {user:null, message: "Pas de token de session trouvé" };
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
    return {user:null, message: "Token de session invalide" };
  }
   // 1. Récupérer les informations de l'appareil à partir des en-têtes
    const deviceId = headersList.get("X-Device-ID");
    const deviceTypeHeader = headersList.get("X-Device-Type");

    // 2. Vérifier la présence des en-têtes essentiels pour l'appareil
    if (!deviceId || !deviceTypeHeader) {
      return {user:null, message: "Pas d'en-têtes d'appareil trouvés." };
    }
    const device = await prisma.device.findFirst({
      where: {
        deviceId
      },
    });
    const isDeviceLoggedIn = device?.logged;
    if (!isDeviceLoggedIn) {
      return {user:null, message: "Appareil non autorisé." };
    }
     const userVerifiedData = session.user.verified?.[0];
    const expiresAt = userVerifiedData?.expiresAt?.getTime() || null;
    const canExpire = !!(expiresAt || null);

    const expired =
      canExpire && expiresAt ? new Date().getTime() < expiresAt : false;

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
  return {user, message: "Utilisateur authentifié." };
}