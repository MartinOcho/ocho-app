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

    // Vérifier ou créer un device pour cette session
    const existingDevice = await prisma.device.findFirst({
      where: {
        sessionId: session.id,
        deviceId: deviceId,
      },
    });

    if (!existingDevice) {
      // Créer un nouveau device en base
      await prisma.device.create({
        data: {
          sessionId: session.id,
          deviceId: deviceId,
          type: "WEB",
          ip: request.headers.get("x-forwarded-for") || "unknown",
        },
      });
    }

    // Retourner le deviceId (sans le set dans le cookie car le client le gère)
    return NextResponse.json(
      { deviceId },
      {
        headers: {
          "Set-Cookie": `X-Device-ID=${deviceId}; Path=/; Max-Age=${60 * 60 * 24 * 365}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
        },
      }
    );
  } catch (error) {
    console.error("Erreur lors de la gestion du deviceId:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
