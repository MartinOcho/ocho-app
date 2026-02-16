import prisma from "@/lib/prisma";
import cloudinary from "@/lib/cloudinary";
import fs from "fs";
import path from "path";
import { UTApi } from "uploadthing/server";

// Base directories for different types of uploads
const attachmentDir = path.resolve("data/uploads/attachments");

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization header" }),
        { status: 401 },
      );
    }

    // Rechercher les médias inutilisés
    const unusedMedia = await prisma.media.findMany({
      where: {
        postId: null,
        ...(process.env.NODE_ENV === "production"
          ? {
              createdAt: {
                lte: new Date(Date.now() - 24 * 3600 * 1000), // 1 jour
              },
            }
          : {}),
      },
      select: {
        id: true,
        url: true,
      },
    });

    // Supprimer les fichiers locaux pour les avatars et les pièces jointes
    unusedMedia.forEach((media) => {
      let filePath: string;

      if (media.url.includes("/uploads/attachments/")) {
        // If it's an attachment
        filePath = path.join(
          attachmentDir,
          media.url.split("/uploads/attachments/")[1],
        );
      } else {
        const key = media.url.split(
          `/a/${process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID}/`,
        )[1];
        new UTApi().deleteFiles(key);
        return;
      }

      // Supprimer le fichier s'il existe
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    // Supprimer les entrées de la base de données
    await prisma.media.deleteMany({
      where: {
        id: {
          in: unusedMedia.map((m) => m.id),
        },
      },
    });

    // Rechercher les pièces jointes de messages inutilisées
    const unusedMessageAttachments = await prisma.messageAttachment.findMany({
      where: {
        messageId: null,
        ...(process.env.NODE_ENV === "production"
          ? {
              createdAt: {
                lte: new Date(Date.now() - 24 * 3600 * 1000), // 1 jour
              },
            }
          : {}),
      },
      select: {
        id: true,
        publicId: true,
      },
    });

    // Supprimer les fichiers des pièces jointes de Cloudinary
    for (const attachment of unusedMessageAttachments) {
      if (attachment.publicId) {
        try {
          await cloudinary.uploader.destroy(attachment.publicId);
        } catch (error) {
          console.error(`Error deleting Cloudinary file ${attachment.publicId}:`, error);
        }
      }
    }

    // Supprimer les entrées de la base de données
    await prisma.messageAttachment.deleteMany({
      where: {
        id: {
          in: unusedMessageAttachments.map((a) => a.id),
        },
      },
    });

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    });
  }
}
