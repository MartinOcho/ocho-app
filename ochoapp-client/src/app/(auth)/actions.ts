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