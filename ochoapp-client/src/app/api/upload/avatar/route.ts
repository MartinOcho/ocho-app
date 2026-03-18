"use server";

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { LocalUpload } from "@/lib/types";
import prisma from "@/lib/prisma";
import { validateRequest } from "@/auth";
import cloudinary from "@/lib/cloudinary";
import { UploadApiResponse } from "cloudinary";

export async function POST(request: NextRequest) {
  const { user } = await validateRequest();
  if (!user) {
    console.error("Action non autorisée");
    return NextResponse.json(
      { error: "Action non autorisée" },
      { status: 403 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const publicId = `user_avatars/${user.id}_${uuidv4()}`;

    const streamUpload = (buffer: Buffer) =>
      new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: "auto",
            folder: "user_avatars",
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

    const uploadResult = await streamUpload(Buffer.from(await file.arrayBuffer()));
    const url = uploadResult.secure_url || uploadResult.url || "";
    const public_id = uploadResult.public_id || null;

    // Supprimer les anciens avatars de l'utilisateur (base et Cloudinary)
    const previousAvatars = await prisma.userAvatar.findMany({
      where: { userId: user.id },
      select: { id: true, publicId: true },
    });

    const newAvatar = await prisma.userAvatar.create({
      data: {
        userId: user.id,
        url,
        publicId: public_id,
        width: uploadResult.width || null,
        height: uploadResult.height || null,
        format: uploadResult.format || null,
        resourceType: uploadResult.resource_type || null,
      },
    });

    // Mettre à jour l'URL de l'avatar dans la table user
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: url },
    });

    // Supprimer les anciens avatars de la base et de Cloudinary
    await prisma.userAvatar.deleteMany({
      where: { id: { in: previousAvatars.map((a) => a.id) } },
    });

    await Promise.all(
      previousAvatars.map(async (old) => {
        if (old.publicId) {
          return cloudinary.uploader.destroy(old.publicId).catch((err) => {
            console.error("Erreur lors de la suppression d'un ancien avatar Cloudinary:", err);
          });
        }
        return Promise.resolve();
      }),
    );

    const name = file.name;
    const appUrl = url;
    const size = file.size;
    const type = file.type || "image/webp";

    return NextResponse.json<LocalUpload[]>([
      {
        url,
        name,
        appUrl,
        size,
        type,
        serverData: {
          avatarUrl: url,
        },
      },
    ]);
  } catch (error) {
    console.error("Erreur générale:", error);
    return NextResponse.json({ error: "File upload failed" }, { status: 500 });
  }
}
