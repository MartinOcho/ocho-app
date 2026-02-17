import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
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

    const { sessionId, logoutAll } = await request.json();

    if (!sessionId && !logoutAll) {
      return NextResponse.json(
        { error: "sessionId ou logoutAll requis" },
        { status: 400 }
      );
    }

    if (logoutAll) {
      // Déconnecter toutes les sessions sauf la session courante
      await prisma.session.deleteMany({
        where: {
          userId: user.id,
          id: {
            not: session.id,
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: "Tous les autres comptes ont été déconnectés",
      });
    }

    // Empêcher de déconnecter sa propre session
    if (sessionId === session.id) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas déconnecter votre session actuelle depuis cette page" },
        { status: 400 }
      );
    }

    // Vérifier que la session appartient à l'utilisateur
    const sessionToDelete = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!sessionToDelete || sessionToDelete.userId !== user.id) {
      return NextResponse.json(
        { error: "Session non trouvée" },
        { status: 404 }
      );
    }

    // Supprimer la session
    await prisma.session.delete({
      where: { id: sessionId },
    });

    return NextResponse.json({
      success: true,
      message: "Compte déconnecté",
    });
  } catch (error) {
    console.error("Erreur lors de la déconnexion:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
