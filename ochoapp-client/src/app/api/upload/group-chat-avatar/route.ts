"use server";

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { getChatRoomDataInclude, LocalUpload } from "@/lib/types";
import prisma from "@/lib/prisma";
import { validateRequest } from "@/auth";
import { UTApi } from "uploadthing/server";
import { MemberType } from "@prisma/client";

const uploadDir = path.resolve("data/uploads/avatars");

export async function POST(request: NextRequest) {
  
  try {
    const { user } = await validateRequest();
    if (!user) {
      console.error("Action non autorisée");
      return NextResponse.json(
        { error: "Action non autorisée" },
        { status: 403 },
      );
    }
    const formData = await request.formData();
    
    const file = formData.get("file") as File | null;
    const roomId = formData.get("id") as string;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!roomId) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: getChatRoomDataInclude(),
    });

    if (!room) {
      return NextResponse.json(
        { error: "Groupe introuvable" },
        { status: 400 },
      );
    }

    if (!room.isGroup) {
      return NextResponse.json(
        { error: "Ce canal de discussion n'est pas un groupe" },
        { status: 400 },
      );
    }

    const loggedMember = room.members.find(
      (member) => member.userId === user.id,
    );

    if (!loggedMember) {
      return NextResponse.json(
        { error: "Vous n'êtes pas membre de ce groupe" },
        { status: 403 },
      );
    }

    const admins: MemberType[] = ["ADMIN", "OWNER"];

    if (!admins.includes(loggedMember.type)) {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour effectuer cette action" },
        { status: 403 },
      );
    }

    const filename = `${uuidv4()}_${file.name}`;
    const filepath = path.join(uploadDir, filename);

    // Assurer que le répertoire de téléchargement existe
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Retourner l'URL relative pour accéder au fichier
    let url = `/api/uploads/avatars/${filename}`;

    // Enregistrer le fichier localement
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.promises.writeFile(filepath, buffer).catch(async (err) => {
      console.error(err);
      throw new Error("Erreur lors de l'enregistrement du fichier");
    });
    const name = filename;
    const appUrl = url;
    const size = file.size;
    const type = "image/webp";

    // Suppression de l'ancien avatar
    const oldAvatarUrl = room.groupAvatarUrl;
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
            console.error(
              "Erreur lors de la suppression de l'ancien avatar:",
              err,
            );
          }
        }
      } else {
        const key = oldAvatarUrl.split(
          `/a/${process.env.NEXT_PUBLIC_UPLOADTHING_APP_ID}/`,
        )[1];
        await new UTApi().deleteFiles(key).catch((err) => {
          console.error(err);
        });
      }
    }

    // Mettre à jour l'URL de l'avatar dans la base de données
    await prisma.room
      .update({
        where: { id: roomId },
        data: { groupAvatarUrl: url },
      })
      .catch((err) => {
        console.error(err);
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
    console.error(error);
    throw new Error ("Echec du telechargement du fichier");
  }
}
