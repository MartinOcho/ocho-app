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

    // Récupérer le deviceId de la session courante
    const currentSession = await prisma.session.findUnique({
      where: { id: session.id },
      select: {
        deviceId: true,
      },
    });

    if (!currentSession || !currentSession.deviceId) {
      return NextResponse.json({
        sessions: [],
        currentSession: {
          sessionId: session.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        },
      });
    }
    const otherSessions = await prisma.session.findMany({
      where: {
        id: { not: session.id }, // Exclure la session courante
        deviceId: currentSession.deviceId, // Seulement les sessions du même device
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
