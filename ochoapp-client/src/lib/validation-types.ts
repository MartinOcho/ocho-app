/**
 * Utilitaires de validation stricte pour les types de données critiques
 * Préventention des erreurs runtime lors de la manipulation des données du socket/cache
 */

import {
  GalleryMedia,
  MessageAttachment,
  MessageData,
} from "@/lib/types";

// ============================================================================
// GALLERY MEDIA VALIDATION
// ============================================================================

/**
 * Type guard pour vérifier qu'un objet est un GalleryMedia valide
 * @param media - Objet à valider
 * @returns true si l'objet est un GalleryMedia valide
 */
export function isValidGalleryMedia(media: unknown): media is GalleryMedia {
  if (!media || typeof media !== "object") return false;

  const candidate = media as Partial<GalleryMedia> & Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.messageId === "string" &&
    typeof candidate.url === "string" &&
    (candidate.type === "IMAGE" || candidate.type === "VIDEO") &&
    typeof candidate.type === "string"
  );
}

/**
 * Valide et filtre un tableau de médias
 * @param medias - Tableau potentiellement invalide
 * @returns Tableau de GalleryMedia validés
 */
export function validateGalleryMedias(medias: unknown[]): GalleryMedia[] {
  if (!Array.isArray(medias)) return [];
  return medias.filter(isValidGalleryMedia);
}

/**
 * Valide un élément de GalleryMedia avec detailing complet
 * @param media - Objet à valider
 * @returns Objet avec validité et erreurs détaillées
 */
export function validateGalleryMediaDetailed(media: unknown): {
  isValid: boolean;
  media: GalleryMedia | null;
  errors: string[];
} {
  const errors: string[] = [];

  if (!media || typeof media !== "object") {
    errors.push("Media is not an object");
    return { isValid: false, media: null, errors };
  }

  const candidate = media as Record<string, unknown>;

  if (!candidate.id || typeof candidate.id !== "string") {
    errors.push("Media missing or invalid id");
  }

  if (!candidate.messageId || typeof candidate.messageId !== "string") {
    errors.push("Media missing or invalid messageId");
  }

  if (!candidate.url || typeof candidate.url !== "string") {
    errors.push("Media missing or invalid url");
  }

  if (candidate.type !== "IMAGE" && candidate.type !== "VIDEO") {
    errors.push(
      `Media has invalid type: ${String(candidate.type)} (expected IMAGE or VIDEO)`
    );
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    media: isValid ? (media as GalleryMedia) : null,
    errors,
  };
}

// ============================================================================
// MESSAGE ATTACHMENT VALIDATION
// ============================================================================

/**
 * Type guard pour vérifier qu'un objet est un MessageAttachment valide
 */
export function isValidMessageAttachment(
  attachment: unknown
): attachment is MessageAttachment {
  if (!attachment || typeof attachment !== "object") return false;

  const candidate = attachment as Partial<MessageAttachment> & Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.url === "string" &&
    (candidate.type === "IMAGE" || candidate.type === "VIDEO") &&
    typeof candidate.type === "string"
  );
}

/**
 * Valide et filtre un tableau d'attachments
 */
export function validateMessageAttachments(
  attachments: unknown[]
): MessageAttachment[] {
  if (!Array.isArray(attachments)) return [];
  return attachments.filter(isValidMessageAttachment);
}

// ============================================================================
// MESSAGE DATA VALIDATION
// ============================================================================

/**
 * Type guard pour vérifier qu'un objet est un MessageData valide
 */
export function isValidMessageData(message: unknown): message is MessageData {
  if (!message || typeof message !== "object") return false;

  const candidate = message as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.senderId === "string" &&
    typeof candidate.roomId === "string" &&
    typeof candidate.type === "string" &&
    !!candidate.createdAt
  );
}

/**
 * Valide et filtre un tableau de messages
 */
export function validateMessages(messages: unknown[]): MessageData[] {
  if (!Array.isArray(messages)) return [];
  return messages.filter(isValidMessageData);
}

// ============================================================================
// ARRAY VALIDATION HELPERS
// ============================================================================

/**
 * Valide que oldData est une structure InfiniteData valide
 * Utile pour setQueryData avec typed updater
 */
export function isValidInfiniteDataStructure<T>(oldData: unknown): oldData is {
  pages: Array<T>;
  pageParams: unknown[];
} {
  return (
    !!oldData &&
    typeof oldData === "object" &&
    Array.isArray((oldData as { pages?: unknown[] }).pages) &&
    Array.isArray((oldData as { pageParams?: unknown[] }).pageParams)
  );
}

/**
 * Vérifie qu'une page existe et a les propriétés attendues
 */
export function isValidPageStructure<T extends Record<string, unknown>>(
  page: unknown,
  expectedKeys: string[]
): page is T {
  if (!page || typeof page !== "object") return false;
  return expectedKeys.every((key) => key in page);
}
