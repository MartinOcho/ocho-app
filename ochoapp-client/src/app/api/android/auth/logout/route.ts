import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(req: NextRequest) {
    // 1. Utilisation de la méthode DELETE pour une action qui modifie l'état.
    const authHeader = req.headers.get("Authorization");
    const deviceId = req.headers.get("X-Device-ID");

    const sessionToken = authHeader?.split(" ")[1];

    if (!sessionToken || !deviceId) {
        return NextResponse.json({
            success: false,
            message: "Missing session token or device ID",
            name: "missing_credentials",
        }, { status: 400 });
    }
    console.log(`Logging out device ${deviceId} with session ${sessionToken}`);
    

    try {
        // 2. Vérifier si l'appareil et la session correspondent en une seule requête atomique.
        const device = await prisma.device.update({
            where: {
                sessionId_deviceId: { sessionId: sessionToken, deviceId: deviceId },
            },
            data: { logged: false },
        });
        
        // La session n'a pas besoin d'être mise à jour car l'état 'logged'
        // est sur le modèle Device. Si l'objectif est aussi de supprimer la session,
        // vous pourriez utiliser 'prisma.session.delete({ where: { id: sessionToken } })'.
        
        return NextResponse.json({
            success: true,
            message: "Successfully logged out",
            data: { deviceId: device.id, logged: device.logged },
        });

    } catch (error) {
        // 3. Gestion des erreurs avec un bloc try...catch.
        // Si l'appareil ou la session n'est pas trouvé, une erreur sera levée.
        console.error("Logout error:", error);
        return NextResponse.json({
            success: true,
            message: "Session or device not found, or already logged out",
            name: "session_not_found",
        });
    }
}
