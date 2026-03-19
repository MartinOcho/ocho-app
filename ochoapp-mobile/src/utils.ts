import type { IncomingHttpHeaders } from "http";
import prisma from "./prisma";
import { ApiResponse, DeviceType, PostData, User, UserData, VerifiedUser } from "./types";
import { loginSchema } from "./validation";
import { verify } from "@node-rs/argon2";
import { de } from "zod/locales";


export async function upSaveDevice(headers: IncomingHttpHeaders, userId: string, sessionId?: string) {
    const headersList = headers;
    const getHeader = (name: string) => {
        const value = headersList[name.toLowerCase() as keyof IncomingHttpHeaders];
        return Array.isArray(value) ? value[0] : value;
    }
    const deviceId = getHeader("X-Device-ID");
    const deviceTypeHeader = getHeader("X-Device-Type");
    const deviceModel = getHeader("X-Device-Model");
    const deviceIp = getHeader("x-forwarded-for") || getHeader("x-real-ip") || "unknown";
    
    if (!deviceId || !deviceTypeHeader) {
        throw new Error("Missing device headers");
    }
    
    const geoLocation = await detectGeoLocationFromIP(deviceIp, headers as any);
    // Vérifier si l'appareil existe déjà ou le créer
    let device = await prisma.device.findUnique({
      where: { deviceId: deviceId },
    });

    if (!device) {
      // Si l'appareil n'existe pas, le créer
      device = await prisma.device.create({
        data: {
          deviceId: deviceId,
          type: (deviceTypeHeader as DeviceType) || "UNKNOWN",
          model: deviceModel || "Unknown Model",
          ip: deviceIp,
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
          ip: deviceIp,
          location: geoLocation.city && geoLocation.countryCode 
            ? `${geoLocation.city}, ${geoLocation.countryCode}` 
            : geoLocation.countryCode || device.location,
          updatedAt: new Date(),
        },
      });
    }
    

    // Associer la session au device
    await prisma.session.update({
      where: { id: sessionId },
      data: { deviceId: deviceId },
    });
    console.log("Session associée au device:", sessionId);

     try {
    // Supprimer toutes les sessions de ce user avec ce deviceId, sauf la nouvelle
    await prisma.session.deleteMany({
      where: {
        userId: userId,
        deviceId: deviceId,
        id: {
          not: sessionId,
        },
      },
    });
  } catch (error) {
    console.error(
      `Erreur lors de la suppression des anciennes sessions pour ${userId} sur device ${deviceId}:`,
      error,
    );
}

export async function checkVerification(userData: UserData): Promise<VerifiedUser> {
   const userVerifiedData = userData.verified?.[0];
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

export async function loginUser(req:Request, res:Response) {
    const input = await req.json();

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
    if (!existingUser || !existingUser.passwordHash){
        return res.json<ApiResponse<null>>({
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
        return res.json<ApiResponse<null>>({
            success: false,
            message: "Nom d'utilisateur ou mot de passe incorrect.",
            name: "AuthenticationError",
            error: null,
        });
    }

    const user = await formatUserResponse(existingUser as unknown as UserData);
    return res.json<ApiResponse<User>>({
        success: true,
        message: "Authentification réussie.",
        name: "AuthenticationSuccess",
        error: null,
        data: user,
    });
}

export async function getCurrentUser(
  headers: IncomingHttpHeaders,
): Promise<{user: User | null; message: string}> {
  const headersList = headers;
  const getHeader = (name: string) => {
    const value = headersList[name.toLowerCase() as keyof IncomingHttpHeaders];
    return Array.isArray(value) ? value[0] : value;
  };

  const authHeader = getHeader("authorization");
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
    const deviceId = getHeader("x-device-id");
    const deviceTypeHeader = getHeader("x-device-type");
    // 2. Vérifier la présence des en-têtes essentiels pour l'appareil
    if (!deviceId || !deviceTypeHeader) {
      return {user:null, message: "Pas d'en-têtes d'appareil trouvés." };
    }

    // 3. Vérifier que le device existe et que la session est associée au device
    const device = await prisma.device.findUnique({
      where: {
        deviceId
      },
    });
    
    // Vérifier que la session appartient au device
    if (!device || session.deviceId !== deviceId) {
      return {user:null, message: "Appareil non autorisé ou session invalide." };
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

export function calculateRelevanceScore(
  post: PostData,
  user: User,
  latestPostId?: string,
): number {
  const userId = user.id;
  const comments = post._count.comments;
  const likes = post._count.likes;
  const bookmarks = post.bookmarks.length;

    const now = new Date();
    const postAgeHours = (now.getTime() - post.createdAt.getTime()) / (1000 * 60 * 60);

    // Calcul de l'engagement
    const engagementScore = likes * 2 + comments * 3 + bookmarks * 1.5;

    // Définir les fourchettes pour le facteur temporel
    let timeFactor = 1; // Par défaut pour les posts récents
    if (postAgeHours > 24 && postAgeHours <= 72) {
      timeFactor = 0.95; // Post récent (1 à 3 jours)
    } else if (postAgeHours > 72 && postAgeHours <= 168) {
      timeFactor = engagementScore > 0 ? 0.9 : 0.8; // Post modérément ancien (3 à 7 jours)
    } else if (postAgeHours > 168) {
      timeFactor = engagementScore > 0 ? 0.85 : 0.6; // Post ancien (> 7 jours)
    }

    // Calcul du score de proximité
    const proximityScore = post.user.followers.some(
      (follower) => follower.followerId === userId,
    )
      ? 5
      : 0;

    // Bonus pour les types de contenu
    const typeFactor =
      post.attachments.length > 0 ? (post.content.length ? 1.5 : 1.25) : 1;

    // Bonus pour les gradients
    const gradientFactor =
      !post.attachments.length && post.content.length < 100 && post.gradient
        ? 1.5
        : 1;

    // Bonus pour le dernier post
    const latestPostBonus = latestPostId && post.id === latestPostId ? 100 : 0;

    // Calcul final
    return (
      engagementScore * timeFactor +
      proximityScore +
      typeFactor +
      gradientFactor +
      latestPostBonus
    );
}

export interface GeoLocationInfo {
  country: string | null;
  countryCode: string | null;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Extrait la localisation à partir des headers Cloudflare (si disponible)
 */
function parseCloudflareHeaders(headers: Headers): GeoLocationInfo | null {
  try {
    const country = headers.get("CF-IPCountry");
    const city = headers.get("CF-Metro-Code"); // Ce n'est pas vraiment la ville, mais approximatif
    const latitude = headers.get("CF-IPLatitude");
    const longitude = headers.get("CF-IPLongitude");

    if (!country) return null;

    return {
      country,
      countryCode: country,
      city: city || null,
      region: null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
    };
  } catch {
    return null;
  }
}

interface GeoLocationAPIResponse {
  status?: string;
  country?: string;
  countryCode?: string;
  city?: string;
  regionName?: string;
  lat?: number;
  lon?: number;
}

/**
 * Récupère la géolocalisation via une API externe (fallback)
 * Utilise ip-api.com (gratuit, pas d'authentification requise)
 */
async function getGeoLocationFromAPI(ip: string): Promise<GeoLocationInfo | null> {
  try {
    // Limiter les appels API pour ne pas surcharger
    const data = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,regionName,lat,lon`, {
      method: "GET",
    }).then(res => res.json() as GeoLocationAPIResponse);

    if (data.status !== "success") {
      return null;
    }
    return {
      country: data.country || null,
      countryCode: data.countryCode || null,
      city: data.city || null,
      region: data.regionName || null,
      latitude: data.lat || null,
      longitude: data.lon || null,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération de la géolocalisation:", error);
    return null;
  }
}

export async function detectGeoLocationFromIP(
  ip: string | null,
  headers?: Headers,
): Promise<GeoLocationInfo> {
  // Essayer Cloudflare en premier
  if (headers) {
    const cfGeo = parseCloudflareHeaders(headers);
    if (cfGeo) {
      return cfGeo;
    }
  }

  // Fallback vers une API externe
  if (ip && ip !== "unknown") {
    const apiGeo = await getGeoLocationFromAPI(ip);
    if (apiGeo) {
      return apiGeo;
    }
  }

  // Au minimum, retourner un objet vide
  return {
    country: null,
    countryCode: null,
    city: null,
    region: null,
    latitude: null,
    longitude: null,
  };
}