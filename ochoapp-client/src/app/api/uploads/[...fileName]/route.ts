import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Base directory for uploaded files
const uploadBaseDir = path.resolve("data/uploads");

export async function GET(request: NextRequest, { params: requestParams }: { params: Promise<{ fileName: string[] }> }) {
  try {
    const params = await requestParams;
    // Join the fileName params to construct the full file path
    const filepath = path.join(uploadBaseDir, ...params.fileName);

    // Check if the file exists
    if (!fs.existsSync(filepath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Read the file into a buffer
    const fileBuffer = await fs.promises.readFile(filepath);

    // Infer content type from the file extension
    const ext = path.extname(filepath).toLowerCase();
    let contentType = "application/octet-stream"; // Default to binary stream
    if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
    if (ext === ".png") contentType = "image/png";
    if (ext === ".webp") contentType = "image/webp";
    if (ext === ".mp4") contentType = "video/mp4";

    // Return the file with the appropriate content type
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    console.error("Error serving file:", error);
    return NextResponse.json({ error: "Error retrieving file" }, { status: 500 });
  }
}
