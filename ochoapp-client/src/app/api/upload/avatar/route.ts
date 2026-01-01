"use server";

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { LocalUpload } from "@/lib/types";
import prisma from "@/lib/prisma";
import { validateRequest } from "@/auth";
import { UTApi } from "uploadthing/server";

const uploadDir = path.resolve("data/uploads/avatars");

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

    const filename = `${uuidv4()}_${file.name}`;
    const filepath = path.join(uploadDir, filename);

    // Assurer que le répertoire de téléchargement existe
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Enregistrer le fichier localement
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.promises.writeFile(filepath, buffer).catch((err) => {
      console.error("Erreur lors de la création du fichier:", err);
      throw new Error("Erreur lors de l'enregistrement du fichier");
    });

    // Retourner l'URL relative pour accéder au fichier
    const url = `/api/uploads/avatars/${filename}`;
    const name = filename;
    const appUrl = url;
    const size = file.size;
    const type = "image/webp";

    // Suppression de l'ancien avatar
    const oldAvatarUrl = user.avatarUrl;
    if (oldAvatarUrl) {
      const isOnLocalServer = oldAvatarUrl.startsWith("/api/uploads/avatars/");
      if (isOnLocalServer) {
        const oldFilePath = path.join(
          uploadDir,
          oldAvatarUrl.split("/uploads/avatars/")[1],
        );

        if (fs.existsSync(oldFilePath)) {
          try {
            fs.unlinkSync(oldFilePath);
          } catch (err) {
            console.error("Erreur lors de la suppression de l'ancien avatar:", err);
          }
        }
      } else {
        const key = oldAvatarUrl.split(
          `/a/${process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID}/`,
        )[1];
        await new UTApi().deleteFiles(key).catch((err) => {
          console.error("Erreur lors de la suppression du fichier distant:", err);
        });
      }
    }

    // Mettre à jour l'URL de l'avatar dans la base de données
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: url },
    }).catch((err) => {
      console.error("Erreur lors de la mise à jour de l'avatar dans la base de données:", err);
      throw new Error("Erreur lors de la mise à jour de l'avatar");
    });

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
