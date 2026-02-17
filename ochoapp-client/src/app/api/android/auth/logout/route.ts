import prisma from "@/lib/prisma";
import { lucia } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(req: NextRequest) {
    // Utilisation de la méthode DELETE pour une action qui modifie l'état.
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
        // Vérifier que la session existe et appartient au device indiqué
        const session = await prisma.session.findUnique({
            where: { id: sessionToken },
            select: { id: true, deviceId: true, userId: true },
        });

        if (!session || session.deviceId !== deviceId) {
            return NextResponse.json({
                success: false,
                message: "Session not found or device mismatch",
                name: "invalid_session",
            }, { status: 404 });
        }

        // Supprimer la session
        await prisma.session.delete({
            where: { id: sessionToken },
        });

        // Invalider la session côté Lucia
        await lucia.invalidateSession(sessionToken);
        
        return NextResponse.json({
            success: true,
            message: "Successfully logged out",
            data: { sessionId: sessionToken, deviceId: deviceId },
        });

    } catch (error) {
        console.error("Logout error:", error);
        return NextResponse.json({
            success: false,
            message: "Logout failed",
            name: "logout_error",
        }, { status: 500 });
    }
}
