import { NextResponse, NextRequest } from "next/server";
import cloudinary from "@/lib/cloudinary";
import { lucia } from "@/auth";
import prisma from "@/lib/prisma";

// Autoriser des corps de requête plus volumineux (base64 d'images/vidéos)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '200mb',
    },
  },
};

const UPLOAD_TIMEOUT = 60000; // 60 secondes timeout
const MAX_RETRIES = 2;

// POST /api/cloudinary/upload
export async function POST(req: NextRequest) {
  try {
    const sessionId = req.cookies.get(lucia.sessionCookieName)?.value;

    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { session, user } = await lucia.validateSession(sessionId);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const file = (body as any).file; // expecting data:image/...;base64,... or url
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    let uploadResult: any = null;
    let lastError: Error | null = null;

    // Boucle de retry
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        // If client sent a data URL (base64), Cloudinary accepts it directly
        // Wrap with timeout
        const uploadPromise = cloudinary.uploader.upload(file, {
          resource_type: "auto",
          folder: (body as any).folder || undefined,
        });

        uploadResult = await Promise.race([
          uploadPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Upload timeout")), UPLOAD_TIMEOUT)
          ),
        ]);

        if (uploadResult) {
          break; // Succès, sortir la boucle de retry
        }
      } catch (error) {
        lastError = error as Error;
        console.error(`Cloudinary upload attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, error);

        // Si on a atteint le nombre max de tentatives, on lance l'erreur
        if (attempt === MAX_RETRIES) {
          throw error;
        }

        // Sinon, attendre avant de retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }

    // Create MessageAttachment in database
    const attachmentType = uploadResult.resource_type && String(uploadResult.resource_type).startsWith("video") 
      ? "VIDEO" 
      : (uploadResult.resource_type === "image" || (uploadResult.secure_url && /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(uploadResult.secure_url)) 
        ? "IMAGE" 
        : "DOCUMENT");

    const messageAttachment = await prisma.messageAttachment.create({
      data: {
        type: attachmentType,
        url: uploadResult.secure_url || uploadResult.url || "",
        publicId: uploadResult.public_id || null,
        width: uploadResult.width || null,
        height: uploadResult.height || null,
        format: uploadResult.format || null,
        resourceType: uploadResult.resource_type || null,
      },
    });

    return NextResponse.json({ 
      success: true, 
      attachmentId: messageAttachment.id,
      result: uploadResult 
    });
  } catch (e) {
    const error = e as Error;
    console.error("Cloudinary upload error:", error);
    
    // Retourner un message d'erreur plus descriptif
    const errorMessage = error.message === "Upload timeout" 
      ? "L'upload a dépassé le délai imparti. Veuillez réessayer."
      : error.message.includes("ECONNREFUSED") || error.message.includes("ENOTFOUND")
      ? "Connexion à Cloudinary impossible. Veuillez vérifier votre connexion internet."
      : error.message || "Erreur lors de l'upload. Veuillez réessayer.";
    
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? error.message : undefined 
      }, 
      { status: 500 }
    );
  }
}
