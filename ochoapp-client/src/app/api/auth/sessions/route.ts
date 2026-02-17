import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { user, session } = await validateRequest();

    if (!user || !session) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Récupérer toutes les sessions actives de cet utilisateur
    const sessions = await prisma.session.findMany({
      where: {
        userId: user.id,
      },
      select: {
        id: true,
        expiresAt: true,
        devices: {
          select: {
            type: true,
            deviceId: true,
          },
        },
      },
      orderBy: {
        expiresAt: "desc",
      },
    });

    // Enrichir avec les infos de l'utilisateur et indiquer la session courante
    const enrichedSessions = sessions.map((sess) => ({
      sessionId: sess.id,
      expiresAt: sess.expiresAt,
      devices: sess.devices,
      isCurrent: sess.id === session.id,
      deviceCount: sess.devices.length,
    }));

    return NextResponse.json({
      sessions: enrichedSessions,
      user: {
        id: user.id,
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
