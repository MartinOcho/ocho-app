/**
 * Détecte la localisation basée sur l'adresse IP
 */

import kyInstance from '@/lib/ky';

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

/**
 * Récupère la géolocalisation via une API externe (fallback)
 * Utilise ip-api.com (gratuit, pas d'authentification requise)
 */
async function getGeoLocationFromAPI(ip: string): Promise<GeoLocationInfo | null> {
  try {
    // Limiter les appels API pour ne pas surcharger
    const data = await kyInstance(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,regionName,lat,lon`, {
      method: "GET",
    }).json() as {
      status?: string;
      country?: string;
      countryCode?: string;
      city?: string;
      regionName?: string;
      lat?: number;
      lon?: number;
    };

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

/**
 * Détecte la géolocalisation basée sur l'IP
 * Essaie d'abord Cloudflare, puis une API de fallback
 */
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
