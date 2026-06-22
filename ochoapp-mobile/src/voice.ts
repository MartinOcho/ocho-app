import { Request, Response } from "express";
import prisma from "./prisma";
import { generateWavesFromAudio, base64ToBuffer } from "./audio-utils";
import { v2 as cloudinary } from "cloudinary";
import { getCurrentUser } from "./auth";
import { randomUUID } from "node:crypto";

interface CloudinaryApi {
  uploader: {
    upload_stream: (options: any, callback: (error: any, result: any) => void) => NodeJS.WritableStream;
    destroy: (publicId: string, options?: any, callback?: (error: any, result: any) => void) => Promise<any> | void;
  };
}

/**
 * Upload une note vocale avec conversion en waves
 * @route POST /api/voice-notes
 * @body {voiceNoteBase64: string, duration: number}
 * @returns {voiceNoteId: string, url: string, waves: number[]}
 */
export async function uploadVoiceNote(req: Request, res: Response) {
  try {
    const { voiceNoteBase64, duration } = <{ voiceNoteBase64?: string; duration?: number }>req.body;

    // Valider l'authentification
    const { user } = await getCurrentUser(req.headers);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentification requise",
      });
    }

    // Valider les données
    if (!voiceNoteBase64 || !duration) {
      return res.status(400).json({
        success: false,
        message: "voiceNoteBase64 et duration sont requis",
      });
    }

    if (typeof duration !== "number" || duration <= 0) {
      return res.status(400).json({
        success: false,
        message: "La durée doit être un nombre positif",
      });
    }

    // Convertir le base64 en buffer
    const audioBuffer = base64ToBuffer(voiceNoteBase64);

    if (audioBuffer.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Données audio invalides",
      });
    }

    // Générer les waves
    const { waves } = await generateWavesFromAudio(audioBuffer, duration);

    // Uploader à Cloudinary
    const voiceNoteUrl = await uploadToCloudinary(audioBuffer);

    // Créer la VoiceNote en base de données
    const voiceNote = await prisma.voiceNote.create({
      data: {
        url: voiceNoteUrl.url,
        publicId: voiceNoteUrl.publicId,
        duration,
        waves,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        voiceNoteId: voiceNote.id,
        url: voiceNote.url,
        waves: voiceNote.waves,
        duration: voiceNote.duration,
      },
    });
  } catch (error) {
    console.error("Erreur uploadVoiceNote:", error);
    return res.status(500).json({
      success: false,
      message: "Erreur lors de l'upload de la note vocale",
    });
  }
}

/**
 * Récupère les détails d'une note vocale
 * @route GET /api/voice-notes/:voiceNoteId
 */
export async function getVoiceNote(req: Request, res: Response) {
  try {
    const { voiceNoteId } = <{ voiceNoteId: string }>req.params;

    const voiceNote = await prisma.voiceNote.findUnique({
      where: { id: voiceNoteId },
    });

    if (!voiceNote) {
      return res.status(404).json({
        success: false,
        message: "Note vocale non trouvée",
      });
    }

    return res.status(200).json({
      success: true,
      data: voiceNote,
    });
  } catch (error) {
    console.error("Erreur getVoiceNote:", error);
    return res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération de la note vocale",
    });
  }
}

/**
 * Supprime une note vocale
 * @route DELETE /api/voice-notes/:voiceNoteId
 */
export async function deleteVoiceNote(req: Request, res: Response) {
  try {
    const { voiceNoteId } = <{ voiceNoteId: string }>req.params;

    // Valider l'authentification
    const { user } = await getCurrentUser(req.headers);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentification requise",
      });
    }

    // Vérifier que la voiceNote existe et supprimer
    const voiceNote = await prisma.voiceNote.findUnique({
      where: { id: voiceNoteId },
    });

    if (!voiceNote) {
      return res.status(404).json({
        success: false,
        message: "Note vocale non trouvée",
      });
    }

    // Supprimer de Cloudinary si elle a un publicId
    if (voiceNote.publicId) {
      try {
        await cloudinary.uploader.destroy(voiceNote.publicId);
      } catch (error) {
        console.warn("Erreur lors de la suppression de Cloudinary:", error);
      }
    }

    // Supprimer de la base de données
    await prisma.voiceNote.delete({
      where: { id: voiceNoteId },
    });

    return res.status(200).json({
      success: true,
      message: "Note vocale supprimée",
    });
  } catch (error) {
    console.error("Erreur deleteVoiceNote:", error);
    return res.status(500).json({
      success: false,
      message: "Erreur lors de la suppression de la note vocale",
    });
  }
}

/**
 * Upload un fichier audio à Cloudinary
 */
async function uploadToCloudinary(
  audioBuffer: Buffer
): Promise<{ url: string; publicId: string }> {
  const uniqueId = randomUUID().replace(/-/g, "_");
      const publicId = `voice_${uniqueId}`;
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "video", // Les fichiers audio sont traités comme video dans Cloudinary
        media_type: "audio",
        folder: "voice_notes",
        public_id: publicId,
      },
      (error, result) => {
        if (error) {
          reject(new Error(`Erreur Cloudinary: ${error.message}`));
        } else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        }
      }
    );

    uploadStream.end(audioBuffer);
  });
}
