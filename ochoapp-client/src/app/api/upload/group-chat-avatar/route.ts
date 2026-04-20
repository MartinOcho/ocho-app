"use server";

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { LocalUpload } from "@/lib/types";
import prisma from "@/lib/prisma";
import { validateRequest } from "@/auth";
import cloudinary from "@/lib/cloudinary";
import { UploadApiResponse } from "cloudinary";
import { MemberType } from "@prisma/client";

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
      include: {
        members: {
          where: { userId: user.id },
          select: { type: true, userId: true },
        },
      },
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

    const publicId = `group_avatars/${roomId}_${uuidv4()}`;

    const streamUpload = (buffer: Buffer) =>
      new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: "auto",
            folder: "group_avatars",
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
    const url = uploadResult.url || uploadResult.secure_url || "";

    // Suppression de l'ancien avatar
    const oldAvatarUrl = room.groupAvatarUrl;
    if (oldAvatarUrl && oldAvatarUrl.includes("cloudinary")) {
      const oldPublicId = oldAvatarUrl.split("/").pop()?.split(".")[0];
      if (oldPublicId) {
        try {
          await cloudinary.uploader.destroy(oldPublicId);
        } catch (error) {
          console.error("Error deleting old group avatar from Cloudinary:", error);
        }
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
    console.error(error);
    return NextResponse.json({ error: "File upload failed" }, { status: 500 });
  }
}

