import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { user, session } = await validateRequest();

    if (!user || !session) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Récupérer les devices de la session courante
    const currentSession = await prisma.session.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        devices: {
          select: {
            deviceId: true,
          },
        },
      },
    });

    if (!currentSession) {
      return NextResponse.json(
        { error: "Session non trouvée" },
        { status: 404 }
      );
    }

    // Récupérer les deviceIds du device courant
    const currentDeviceIds = currentSession.devices.map((d) => d.deviceId);

    // Récupérer SEULEMENT les other sessions du MÊME device (excluant la session courante)
    const otherSessions = await prisma.session.findMany({
      where: {
        userId: user.id,
        id: { not: session.id }, // Exclure la session courante
        devices: {
          some: {
            deviceId: { in: currentDeviceIds }, // Seulement les sessions du même device
          },
        },
      },
      select: {
        id: true,
        expiresAt: true,
        user: {
          select: {
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        expiresAt: "desc",
      },
    });

    return NextResponse.json({
      sessions: otherSessions.map((sess) => ({
        sessionId: sess.id,
        username: sess.user.username,
        displayName: sess.user.displayName,
        avatarUrl: sess.user.avatarUrl,
        expiresAt: sess.expiresAt,
      })),
      currentSession: {
        sessionId: session.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des sessions:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
