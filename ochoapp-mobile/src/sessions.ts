import { Request, Response } from "express";
import prisma from "./prisma";
import { ApiResponse } from "./types";

interface Session {
  sessionId: string;
  expiresAt: Date;
  isCurrent: boolean;
}

interface Device {
  deviceId: string;
  type: string;
  model: string | null;
  ip: string | null;
  location: string | null;
  createdAt: Date;
  updatedAt: Date;
  sessions: Session[];
}

interface SessionsResponse {
  currentSessionId: string;
  devices: Device[];
}

/**
 * Récupère toutes les sessions actives de l'utilisateur avec les informations des appareils
 */
export async function getActiveSessions(req: Request, res: Response) {
  try {
    // L'utilisateur est identifié par le sessionId dans le header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.json({
        success: false,
        error: "Authentification requise",
        message: "Session invalide ou expirée",
      } as ApiResponse<null>);
    }

    const sessionId = authHeader.split(" ")[1];

    // Valider la session
    const currentSession = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!currentSession || !currentSession.user) {
      return res.json({
        success: false,
        error: "Session invalide",
        message: "La session n'existe pas ou a expiré",
      } as ApiResponse<null>);
    }

    const userId = currentSession.user.id;

    // Récupérer toutes les sessions de l'utilisateur avec leurs informations d'appareil
    const allSessions = await prisma.session.findMany({
      where: {
        userId: userId,
      },
      select: {
        id: true,
        expiresAt: true,
        deviceId: true,
        device: {
          select: {
            id: true,
            deviceId: true,
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
            deviceId: sess.device.deviceId,
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
          isCurrent: sess.id === sessionId,
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

    return res.json({
      success: true,
      data: {
        currentSessionId: sessionId,
        devices,
      } as SessionsResponse,
    } as ApiResponse<SessionsResponse>);
  } catch (error) {
    console.error("Erreur lors de la récupération des sessions actives:", error);
    return res.json({
      success: false,
      error: "Erreur serveur",
      message: "Impossible de récupérer les sessions actives",
    } as ApiResponse<null>);
  }
}

/**
 * Supprime une session spécifique (déconnexion d'un appareil)
 */
export async function removeSession(req: Request, res: Response) {
  try {
    const { sessionId } = <{ sessionId: string }>req.params;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.json({
        success: false,
        error: "Authentification requise",
        message: "Session invalide ou expirée",
      } as ApiResponse<null>);
    }

    const currentSessionId = authHeader.split(" ")[1];

    // Valider la session courante
    const currentSession = await prisma.session.findUnique({
      where: { id: currentSessionId },
      include: { user: true },
    });

    if (!currentSession || !currentSession.user) {
      return res.json({
        success: false,
        error: "Session invalide",
        message: "La session n'existe pas ou a expiré",
      } as ApiResponse<null>);
    }

    const userId = currentSession.user.id;

    // Vérifier que la session à supprimer appartient à l'utilisateur
    const sessionToRemove = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!sessionToRemove || sessionToRemove.userId !== userId) {
      return res.json({
        success: false,
        error: "Accès refusé",
        message: "Vous n'avez pas la permission de supprimer cette session",
      } as ApiResponse<null>);
    }

    // Empêcher la suppression de la session courante
    if (sessionId === currentSessionId) {
      return res.json({
        success: false,
        error: "Opération invalide",
        message: "Vous ne pouvez pas supprimer votre session courante",
      } as ApiResponse<null>);
    }

    // Supprimer la session
    await prisma.session.delete({
      where: { id: sessionId },
    });

    return res.json({
      success: true,
      message: "Session supprimée avec succès",
    } as ApiResponse<null>);
  } catch (error) {
    console.error("Erreur lors de la suppression de la session:", error);
    return res.json({
      success: false,
      error: "Erreur serveur",
      message: "Impossible de supprimer la session",
    } as ApiResponse<null>);
  }
}

/**
 * Supprime toutes les autres sessions (déconnexion de tous les appareils sauf le courant)
 */
export async function removeAllOtherSessions(req: Request, res: Response) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.json({
        success: false,
        error: "Authentification requise",
        message: "Session invalide ou expirée",
      } as ApiResponse<null>);
    }

    const currentSessionId = authHeader.split(" ")[1];

    // Valider la session courante
    const currentSession = await prisma.session.findUnique({
      where: { id: currentSessionId },
      include: { user: true },
    });

    if (!currentSession || !currentSession.user) {
      return res.json({
        success: false,
        error: "Session invalide",
        message: "La session n'existe pas ou a expiré",
      } as ApiResponse<null>);
    }

    const userId = currentSession.user.id;

    // Compter les sessions à supprimer
    const sessionsToDelete = await prisma.session.count({
      where: {
        userId: userId,
        id: { not: currentSessionId },
      },
    });

    // Supprimer toutes les autres sessions
    await prisma.session.deleteMany({
      where: {
        userId: userId,
        id: { not: currentSessionId },
      },
    });

    return res.json({
      success: true,
      message: `${sessionsToDelete} session(s) supprimée(s) avec succès`,
      data: {
        deletedCount: sessionsToDelete,
      },
    } as ApiResponse<{ deletedCount: number }>);
  } catch (error) {
    console.error("Erreur lors de la suppression des sessions:", error);
    return res.json({
      success: false,
      error: "Erreur serveur",
      message: "Impossible de supprimer les sessions",
    } as ApiResponse<null>);
  }
}
