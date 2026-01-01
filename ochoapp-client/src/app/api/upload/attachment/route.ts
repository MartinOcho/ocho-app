"use server";

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import prisma from "@/lib/prisma"; // Assure-toi que le chemin est correct

const uploadDir = path.resolve("data/uploads/attachments");

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const filename = `${uuidv4()}_${file.name}`;
    const filepath = path.join(uploadDir, filename);

    // Ensure the directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Write the file to the upload directory asynchronously
    await fs.promises.writeFile(filepath, buffer);

    const fileUrl = `/api/uploads/attachments/${filename}`; // URL servie via une route API

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
