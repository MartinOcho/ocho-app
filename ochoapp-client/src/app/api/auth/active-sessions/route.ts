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

    // Récupérer toutes les sessions de l'utilisateur avec leurs informations d'appareil
    const allSessions = await prisma.session.findMany({
      where: {
        userId: user.id,
      },
      select: {
        id: true,
        expiresAt: true,
        deviceId: true,
        device: {
          select: {
            id: true,
            type: true,
            model: true,
            ip: true,
            location: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: {
        device: {
          updatedAt: "desc",
        },
      },
    });

    // Grouper les résultats par appareil
    const sessionsByDevice: Record<
      string,
      {
        deviceId: string;
        type: string;
        model: string | null;
        ip: string | null;
        location: string | null;
        createdAt: Date;
        updatedAt: Date;
        sessions: Array<{
          sessionId: string;
          expiresAt: Date;
          isCurrent: boolean;
        }>;
      }
    > = {};

    allSessions.forEach((sess) => {
      if (sess.device && sess.deviceId) {
        if (!sessionsByDevice[sess.deviceId]) {
          sessionsByDevice[sess.deviceId] = {
            deviceId: sess.deviceId,
            type: sess.device.type,
            model: sess.device.model,
            ip: sess.device.ip,
            location: sess.device.location,
            createdAt: sess.device.createdAt,
            updatedAt: sess.device.updatedAt,
            sessions: [],
          };
        }

        sessionsByDevice[sess.deviceId].sessions.push({
          sessionId: sess.id,
          expiresAt: sess.expiresAt,
          isCurrent: sess.id === session.id,
        });
      }
    });

    const devices = Object.values(sessionsByDevice).map((device) => ({
      ...device,
      sessions: device.sessions.sort(
        (a, b) => b.expiresAt.getTime() - a.expiresAt.getTime()
      ),
    }));

    // Trier les appareils par mise à jour la plus récente
    devices.sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );

    return NextResponse.json({
      currentSessionId: session.id,
      devices,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des sessions actives:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
