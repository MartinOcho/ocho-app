/**
 * Parse le User Agent pour extraire le nom du device et le système d'exploitation
 */
export interface ParsedDeviceInfo {
  name: string; // e.g., "Chrome Windows", "Safari iOS", "Edge Windows"
  osName: string; // e.g., "Windows", "iOS", "Android", "macOS"
  browserName: string; // e.g., "Chrome", "Safari", "Edge"
}

export function parseUserAgent(userAgent: string): ParsedDeviceInfo {
  const ua = userAgent.toLowerCase();

  // Déterminer le navigateur
  let browserName = "Unknown";
  if (ua.includes("edg/")) {
    browserName = "Edge";
  } else if (ua.includes("chrome")) {
    browserName = "Chrome";
  } else if (ua.includes("safari") && !ua.includes("chrome")) {
    browserName = "Safari";
  } else if (ua.includes("firefox")) {
    browserName = "Firefox";
  } else if (ua.includes("opera") || ua.includes("opr/")) {
    browserName = "Opera";
  }

  // Déterminer le système d'exploitation
  let osName = "Unknown";
  if (ua.includes("windows")) {
    osName = "Windows";
  } else if (ua.includes("iphone") || ua.includes("ipad")) {
    osName = "iOS";
  } else if (ua.includes("android")) {
    osName = "Android";
  } else if (ua.includes("mac")) {
    osName = "macOS";
  } else if (ua.includes("linux")) {
    osName = "Linux";
  }

  // Créer le nom du device (e.g., "Chrome Windows", "Safari iOS")
  const name = `${browserName} ${osName}`;

  return {
    name,
    osName,
    browserName,
  };
}

/**
 * Génère un descriptif court du device pour affichage
 */
export function getDeviceDescription(userAgent: string): string {
  const parsed = parseUserAgent(userAgent);
  return parsed.name;
}
