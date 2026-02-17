import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

export async function GET(request: Request) {
  try {
    const { user, session } = await validateRequest();

    if (!user || !session) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const cookiesStore = await cookies();
    
    // Chercher un deviceId existant dans les cookies
    let deviceId = cookiesStore.get("X-Device-ID")?.value;

    if (!deviceId) {
      // Générer un nouveau deviceId unique
      deviceId = uuidv4();
    }

    // Vérifier si un Device avec ce deviceId existe déjà
    let device = await prisma.device.findUnique({
      where: { deviceId: deviceId },
    });

    // Si le device n'existe pas, le créer
    if (!device) {
      device = await prisma.device.create({
        data: {
          deviceId: deviceId,
          type: "WEB",
          ip: request.headers.get("x-forwarded-for") || "unknown",
        },
      });
    }

    // Vérifier si cette session est déjà associée à ce device
    const currentSession = await prisma.session.findUnique({
      where: { id: session.id },
      select: { deviceId: true },
    });

    // Si la session n'est pas encore associée au device, la mettre à jour
    if (currentSession?.deviceId !== deviceId) {
      await prisma.session.update({
        where: { id: session.id },
        data: { deviceId: deviceId },
      });
    }

    // Sauvegarder le deviceId dans un cookie HTTP-Only persistant
    cookiesStore.set("X-Device-ID", deviceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 an
      path: "/",
    });

    return NextResponse.json({ deviceId });
  } catch (error) {
    console.error("Erreur lors de la gestion du deviceId:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
