"use server";

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import prisma from "@/lib/prisma"; // Assure-toi que le chemin est correct
import { validateRequest } from "@/auth";
import cloudinary from "@/lib/cloudinary";
import { UploadApiResponse } from "cloudinary";

export async function POST(request: NextRequest) {
  const { user } = await validateRequest();
  if (!user) {
    return NextResponse.json(
      { error: "Action non autorisée" },
      { status: 403 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const publicId = `post_attachments/${user.id}_${uuidv4()}`;
    const streamUpload = (buffer: Buffer) =>
      new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: "auto",
            folder: "post_attachments",
            public_id: publicId,
            overwrite: true,
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result as UploadApiResponse);
          },
        );
        stream.end(buffer);
      });

    const uploadResult = await streamUpload(
      Buffer.from(await file.arrayBuffer()),
    );
    const fileUrl = uploadResult.secure_url || uploadResult.url || "";

    // Save the file metadata in the database
    const media = await prisma.media.create({
      data: {
        url: fileUrl,
        type: file.type.startsWith("image") ? "IMAGE" : "VIDEO",
      },
    });

    return NextResponse.json({ mediaId: media.id, fileUrl });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json({ error: "File upload failed" }, { status: 500 });
  }
}
