import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { lucia } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { user, session } = await validateRequest();

    if (!user || !session) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId requis" },
        { status: 400 }
      );
    }

    // Vérifier que la session à supprimer appartient à l'utilisateur
    const targetSession = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true, id: true },
    });

    if (!targetSession) {
      return NextResponse.json(
        { error: "Session non trouvée" },
        { status: 404 }
      );
    }

    if (targetSession.userId !== user.id) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 403 }
      );
    }

    // Empêcher de déconnecter sa propre session
    if (sessionId === session.id) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas déconnecter la session actuelle d'ici" },
        { status: 400 }
      );
    }

    // Supprimer la session
    await prisma.session.delete({
      where: { id: sessionId },
    });

    // Invalider la session côté Lucia
    await lucia.invalidateSession(sessionId);

    return NextResponse.json({
      success: true,
      message: "Session supprimée avec succès",
    });
  } catch (error) {
    console.error("Erreur lors de la suppression de la session:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
