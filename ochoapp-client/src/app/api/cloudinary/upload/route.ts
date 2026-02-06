import { NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";

// POST /api/cloudinary/upload
export async function POST(req: Request) {
  try {
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

    return NextResponse.json({ success: true, result: uploadResult });
  } catch (e) {
    console.error("Cloudinary upload error:", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
