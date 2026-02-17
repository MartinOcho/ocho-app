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

    // Vérifier si un device avec le même deviceId + sessionId existe déjà
    // Cette combinaison doit être unique
    const existingDevice = await prisma.device.findFirst({
      where: {
        sessionId: session.id,
        deviceId: deviceId,
      },
    });

    // Si ce device n'existe pas pour cette session, le créer
    if (!existingDevice) {
      // Créer le nouvel enregistrement device pour cette session
      // Cela associe la session active au deviceId (même ou nouveau)
      await prisma.device.create({
        data: {
          sessionId: session.id,
          deviceId: deviceId,
          type: "WEB",
          ip: request.headers.get("x-forwarded-for") || "unknown",
        },
      });
    }

    // Sauvegarder le deviceId dans un cookie HTTP-Only persistant
    // (remplace l'ancien cookie s'il existe)
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
