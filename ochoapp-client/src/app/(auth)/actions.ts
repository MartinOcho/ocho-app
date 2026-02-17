"use server"

import { lucia, validateRequest } from "@/auth"
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function logout(){
    const {session} = await validateRequest()
 
    if (!session) {
        throw new Error("Action non autorisée");
    }
    await prisma.session.deleteMany({
        where: {
            id: session.id
        }
    })

    await lucia.invalidateSession(session.id);

    const sessionCookie = lucia.createBlankSessionCookie();

    const cookieCall = await cookies()

    cookieCall.set(
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes
    )

    return redirect("/login")
}

export async function switchAccount(sessionId: string) {
    const cookieCall = await cookies();
    
    if (!sessionId) {
        throw new Error("Session ID invalide");
    }

    // Valider que la session existe
    const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { user: true }
    });

    if (!session) {
        throw new Error("Session non trouvée");
    }

    // Créer le cookie de session pour basculer vers ce compte
    const sessionCookie = lucia.createSessionCookie(sessionId);

    cookieCall.set(
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes
    );

    return { success: true, userId: session.userId };
}

export async function getAvailableAccounts() {
    const { user, session } = await validateRequest();
    
    if (!user || !session) {
        throw new Error("Non authentifié");
    }

    // Récupérer toutes les sessions de cet utilisateur avec leurs devices
    const sessions = await prisma.session.findMany({
        where: {
            userId: user.id,
        },
        select: {
            id: true,
            expiresAt: true,
            deviceId: true,
            device: {
                select: {
                    type: true,
                }
            }
        },
        orderBy: {
            expiresAt: "desc",
        }
    });

    // Mapper pour créer les comptes disponibles avec les infos utilisateur
    return {
        currentUser: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
        },
        accounts: sessions.map((sess) => ({
            sessionId: sess.id,
            userId: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            expiresAt: sess.expiresAt,
            isCurrent: sess.id === session.id,
            deviceCount: 1, // Chaque session correspond à un device
        })),
    };
}

export async function logoutSpecificSession(sessionId: string) {
    const { user, session } = await validateRequest();
    
    if (!user || !session) {
        throw new Error("Non authentifié");
    }

    if (!sessionId) {
        throw new Error("Session ID invalide");
    }

    // Empêcher de déconnecter sa propre session via cette route
    if (sessionId === session.id) {
        throw new Error("Vous devez utiliser la page de déconnexion sélective");
    }

    // Vérifier que la session appartient bien à l'utilisateur
    const sessionToDelete = await prisma.session.findUnique({
        where: { id: sessionId },
    });

    if (!sessionToDelete || sessionToDelete.userId !== user.id) {
        throw new Error("Session non trouvée");
    }

    // Supprimer la session
    await prisma.session.delete({
        where: { id: sessionId },
    });

    return { success: true, message: "Compte déconnecté" };
}

export async function logoutAllOtherSessions() {
    const { user, session } = await validateRequest();
    
    if (!user || !session) {
        throw new Error("Non authentifié");
    }

    // Déconnecter toutes les sessions sauf la session courante
    await prisma.session.deleteMany({
        where: {
            userId: user.id,
            id: {
                not: session.id,
            },
        },
    });

    return { success: true, message: "Tous les autres comptes ont été déconnectés" };
}
