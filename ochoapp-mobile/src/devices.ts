import type { IncomingHttpHeaders } from "http";
import prisma from "./prisma";
import { DeviceType } from "./types";
import { Session } from "@prisma/client";

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
async function getGeoLocationFromAPI(
  ip: string,
): Promise<GeoLocationInfo | null> {
  try {
    // Limiter les appels API pour ne pas surcharger
    const data = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,regionName,lat,lon`,
      {
        method: "GET",
      },
    ).then((res) => res.json() as GeoLocationAPIResponse);

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
    console.error(
      "Erreur lors de la récupération de la géolocalisation:",
      error,
    );
    return null;
  }
}

export async function upSaveDevice(
  headers: IncomingHttpHeaders,
  userId: string,
  sessionId?: string,
): Promise<Session | null> {
  try {
    const headersList = headers;
    const getHeader = (name: string) => {
      const value =
        headersList[name.toLowerCase() as keyof IncomingHttpHeaders];
      return Array.isArray(value) ? value[0] : value;
    };
    const deviceId = getHeader("X-Device-ID");
    const deviceTypeHeader = getHeader("X-Device-Type");
    const deviceModel = getHeader("X-Device-Model");
    const deviceIp =
      getHeader("x-forwarded-for") || getHeader("x-real-ip") || "unknown";

    if (!deviceId || !deviceTypeHeader) {
      console.warn("Headers d'appareil manquants:", {
        deviceId,
        deviceType: deviceTypeHeader,
      });
      return null;
    }

    const geoLocation = await getGeoLocationFromAPI(deviceIp);

    if (!geoLocation) {
      console.warn("Géolocalisation non disponible pour l'IP:", deviceIp);
      return null;
    }
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
          location:
            geoLocation.city && geoLocation.countryCode
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
          location:
            geoLocation.city && geoLocation.countryCode
              ? `${geoLocation.city}, ${geoLocation.countryCode}`
              : geoLocation.countryCode || device.location,
          updatedAt: new Date(),
        },
      });
    }

    // Associer la session au device
    const session = await prisma.session.update({
      where: { id: sessionId },
      data: { deviceId: deviceId },
    });
    console.log("Session associée au device:", sessionId);

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

    return session;
  } catch (error) {
    console.error("Erreur lors de l'enregistrement de l'appareil:", error);
    return null;
  }
}
