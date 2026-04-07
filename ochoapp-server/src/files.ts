/**
 * Dictionnaire exhaustif des types MIME courants et avancés vers leurs extensions correspondantes.
 * Le type Record<string, string> permet d'accepter n'importe quelle chaîne en entrée
 * sans provoquer d'erreur de typage stricte.
 */
export const MIME_EXTENSION_MAP: Record<string, string> = {
  // --- Images Standards et Modernes ---
  "image/svg+xml": "svg",
  "image/jpeg": "jpg", // Correspond aussi à .jpeg ou .jpe
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/tiff": "tiff", // Correspond aussi à .tif
  "image/x-icon": "ico",
  "image/bmp": "bmp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/jp2": "jp2", // JPEG 2000
  "image/vnd.adobe.photoshop": "psd",
  "image/x-xcf": "xcf", // GIMP

  // --- Documents Bureautiques (Microsoft) ---
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.visio": "vsd",

  // --- Documents Bureautiques (OpenDocument / LibreOffice) ---
  "application/vnd.oasis.opendocument.text": "odt",
  "application/vnd.oasis.opendocument.spreadsheet": "ods",
  "application/vnd.oasis.opendocument.presentation": "odp",
  "application/vnd.oasis.opendocument.graphics": "odg",

  // --- Documents de Lecture et Autres ---
  "application/pdf": "pdf",
  "application/epub+zip": "epub",
  "application/x-mobipocket-ebook": "mobi",
  "application/vnd.amazon.ebook": "azw",
  "application/rtf": "rtf",
  "text/rtf": "rtf",

  // --- Texte, Web et Code Source ---
  "text/plain": "txt",
  "text/html": "html", // Correspond aussi à .htm
  "text/css": "css",
  "text/javascript": "js", // Obsolète mais toujours utilisé, préféré à application/javascript
  "application/javascript": "js",
  "text/javascript; charset=utf-8": "js",
  "application/x-javascript": "js",
  "text/x-javascript": "js",
  "application/typescript": "ts",
  "text/csv": "csv",
  "text/markdown": "md",
  "text/yaml": "yaml", // Correspond aussi à .yml
  "application/x-yaml": "yaml",
  "text/x-python": "py",
  "text/x-java-source": "java",
  "text/x-c": "c",
  "text/x-c++src": "cpp",
  "text/x-shellscript": "sh",
  "application/x-sh": "sh",
  "application/x-httpd-php": "php",
  "text/x-php": "php",

  // --- Données Structurées et Échange ---
  "application/json": "json",
  "application/ld+json": "json",
  "application/activity+json": "json",
  "application/geo+json": "json", // GeoJSON
  "application/vnd.api+json": "json",
  "application/xml": "xml",
  "text/xml": "xml",
  "application/toml": "toml",
  "text/vcard": "vcf",
  "text/calendar": "ics",

  // --- Polices d'Écriture ---
  "font/woff": "woff",
  "font/woff2": "woff2",
  "font/ttf": "ttf",
  "font/otf": "otf",
  "font/collection": "ttc",
  "application/vnd.ms-fontobject": "eot", // Polices web legacy (IE)

  // --- Modèles 3D et CAO ---
  "model/gltf+json": "gltf",
  "model/gltf-binary": "glb",
  "model/obj": "obj",
  "model/mtl": "mtl",
  "model/stl": "stl",
  "application/vnd.autodesk.autocad": "dwg",

  // --- Archives, Compression et Installation ---
  "application/zip": "zip",
  "application/x-rar-compressed": "rar",
  "application/x-7z-compressed": "7z",
  "application/gzip": "gz",
  "application/x-tar": "tar",
  "application/x-bzip": "bz",
  "application/x-bzip2": "bz2",
  "application/x-xz": "xz",
  "application/java-archive": "jar",
  "application/vnd.android.package-archive": "apk",
  "application/x-apple-diskimage": "dmg",
  "application/x-iso9660-image": "iso",
  "application/vnd.debian.binary-package": "deb",
  "application/x-redhat-package-manager": "rpm",

  // --- Audio ---
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/aac": "aac",
  "audio/flac": "flac",
  "audio/mp4": "m4a",
  "audio/midi": "midi", // Correspond aussi à .mid
  "audio/x-midi": "midi",
  "audio/webm": "weba",
  "audio/opus": "opus",
  "audio/x-ms-wma": "wma",

  // --- Vidéo ---
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/x-msvideo": "avi",
  "video/mpeg": "mpeg", // Correspond aussi à .mpg
  "video/ogg": "ogv",
  "video/x-matroska": "mkv",
  "video/quicktime": "mov",
  "video/x-ms-wmv": "wmv",
  "video/x-flv": "flv",
  "video/3gpp": "3gp",
  "video/3gpp2": "3g2",
  "video/mp2t": "ts",

  // --- Applications et Binaires Divers ---
  "application/octet-stream": "bin", // Type générique binaire
  "application/x-msdownload": "exe",
  "application/x-dosexec": "exe",
  "application/vnd.microsoft.portable-executable": "exe",
  "application/x-sharedlib": "so",
  "application/x-shockwave-flash": "swf", // Legacy web
  "application/pgp-signature": "sig",
};
/**
 * Interface représentant l'objet fichier attendu.
 * Compatible avec l'objet File natif du navigateur, tout en restant flexible.
 */
export interface FileLike {
  name?: string;
  type?: string;
}

/**
 * Extrait l'extension à partir d'une chaîne de caractères représentant un type MIME.
 * * @param mime - Le type MIME sous forme de chaîne (ex: "image/jpeg")
 * @returns L'extension correspondante ou null si introuvable
 */
export const extractExtensionFromMime = (mime?: string | null): string | null => {
  if (!mime) return null;

  // Normalisation de la chaîne pour éviter les erreurs de casse ou d'espaces
  const normalizedMime = mime.toLowerCase().trim();

  // 1. Mapping explicite (le plus fiable)
  if (MIME_EXTENSION_MAP[normalizedMime]) {
    return MIME_EXTENSION_MAP[normalizedMime];
  }

  // Séparation du type (ex: text) et du sous-type (ex: plain;charset=UTF-8)
  const mimeParts = normalizedMime.split("/");
  if (mimeParts.length < 2) return null;

  // Nettoyage des paramètres additionnels du sous-type (ex: supprime ";charset=UTF-8")
  const rawSubtype = mimeParts[1];
  const subtype = rawSubtype.split(";")[0].trim();
  
  if (!subtype) return null;

  // 2. Gestion intelligente des suffixes avec "+"
  if (subtype.includes("+")) {
    const parts = subtype.split("+");

    // Priorité aux suffixes standards reconnus
    const knownSuffixes = ["json", "xml", "zip", "cbor"];
    const match = parts.find((p) => knownSuffixes.includes(p));

    if (match) return match;

    // Fallback : le dernier segment est souvent le format de sérialisation
    return parts[parts.length - 1];
  }

  // 3. Cas simple (ex: "image/bmp" -> "bmp")
  return subtype;
};

/**
 * Détermine l'extension d'un fichier en se basant en priorité sur son nom,
 * puis sur son type MIME en cas d'échec.
 * * @param file - L'objet fichier (File, Blob, ou objet partiel)
 * @returns L'extension du fichier, ou "dat" par défaut
 */
export const getFileExtension = (file?: FileLike | null): string => {
  if (!file) return "dat";

  // 1. Priorité absolue au nom du fichier
  if (file.name && file.name.includes(".")) {
    const parts = file.name.split(".");
    const ext = parts.pop()?.toLowerCase().trim();
    
    // On s'assure que l'extension n'est pas vide (cas d'un fichier finissant par un point)
    if (ext) {
      return ext;
    }
  }

  // 2. Fallback sur le type MIME fourni par le système/navigateur
  const extFromMime = extractExtensionFromMime(file.type);
  if (extFromMime) {
    return extFromMime;
  }

  // 3. Fallback final générique pour les données binaires inconnues
  return "dat";
};