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
export function isValidGalleryMedia(media: any): media is GalleryMedia {
  return (
    !!media &&
    typeof media === "object" &&
    !!media.id &&
    typeof media.id === "string" &&
    !!media.messageId &&
    typeof media.messageId === "string" &&
    !!media.url &&
    typeof media.url === "string" &&
    (media.type === "IMAGE" || media.type === "VIDEO") &&
    typeof media.type === "string"
  );
}

/**
 * Valide et filtre un tableau de médias
 * @param medias - Tableau potentiellement invalide
 * @returns Tableau de GalleryMedia validés
 */
export function validateGalleryMedias(medias: any[]): GalleryMedia[] {
  if (!Array.isArray(medias)) return [];
  return medias.filter(isValidGalleryMedia);
}

/**
 * Valide un élément de GalleryMedia avec detailing complet
 * @param media - Objet à valider
 * @returns Objet avec validité et erreurs détaillées
 */
export function validateGalleryMediaDetailed(media: any): {
  isValid: boolean;
  media: GalleryMedia | null;
  errors: string[];
} {
  const errors: string[] = [];

  if (!media || typeof media !== "object") {
    errors.push("Media is not an object");
    return { isValid: false, media: null, errors };
  }

  if (!media.id || typeof media.id !== "string") {
    errors.push("Media missing or invalid id");
  }

  if (!media.messageId || typeof media.messageId !== "string") {
    errors.push("Media missing or invalid messageId");
  }

  if (!media.url || typeof media.url !== "string") {
    errors.push("Media missing or invalid url");
  }

  if (media.type !== "IMAGE" && media.type !== "VIDEO") {
    errors.push(
      `Media has invalid type: ${media.type} (expected IMAGE or VIDEO)`
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
  attachment: any
): attachment is MessageAttachment {
  return (
    !!attachment &&
    typeof attachment === "object" &&
    !!attachment.id &&
    typeof attachment.id === "string" &&
    !!attachment.url &&
    typeof attachment.url === "string" &&
    (attachment.type === "IMAGE" || attachment.type === "VIDEO") &&
    typeof attachment.type === "string"
  );
}

/**
 * Valide et filtre un tableau d'attachments
 */
export function validateMessageAttachments(
  attachments: any[]
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
export function isValidMessageData(message: any): message is MessageData {
  return (
    !!message &&
    typeof message === "object" &&
    !!message.id &&
    typeof message.id === "string" &&
    !!message.senderId &&
    typeof message.senderId === "string" &&
    !!message.roomId &&
    typeof message.roomId === "string" &&
    !!message.type &&
    typeof message.type === "string" &&
    !!message.createdAt
  );
}

/**
 * Valide et filtre un tableau de messages
 */
export function validateMessages(messages: any[]): MessageData[] {
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
export function isValidInfiniteDataStructure<T>(oldData: any): oldData is {
  pages: Array<T>;
  pageParams: any[];
} {
  return (
    !!oldData &&
    typeof oldData === "object" &&
    Array.isArray(oldData.pages) &&
    Array.isArray(oldData.pageParams)
  );
}

/**
 * Vérifie qu'une page existe et a les propriétés attendues
 */
export function isValidPageStructure<T extends { [key: string]: any }>(
  page: any,
  expectedKeys: string[]
): page is T {
  if (!page || typeof page !== "object") return false;
  return expectedKeys.every((key) => key in page);
}
