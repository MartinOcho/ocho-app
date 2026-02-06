import { NextResponse, NextRequest } from "next/server";
import cloudinary from "@/lib/cloudinary";
import { lucia } from "@/auth";
import prisma from "@/lib/prisma";

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

    // If client sent a data URL (base64), Cloudinary accepts it directly
    const uploadResult = await cloudinary.uploader.upload(file, {
      resource_type: "auto",
      folder: (body as any).folder || undefined,
    });

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
    console.error("Cloudinary upload error:", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
