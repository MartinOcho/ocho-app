import prisma from "@/lib/prisma";
import { github } from "../../auth";
import { generateState } from "arctic";
import { cookies } from "next/headers";



export async function GET(req: Request) {
    try {
        // Récupérer le deviceId depuis les headers
        const deviceId = req.headers.get("X-Device-ID");
        const userAgent = req.headers.get("user-agent") || "";
        
        if (!deviceId) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: "DEVICE_NOT_REGISTERED",
                    message: "Votre appareil n'est pas enregistré. Veuillez mettre à jour l'application.",
                    code: "ERR_DEVICE_NOT_FOUND"
                }),
                {
                    status: 403,
                    headers: { "Content-Type": "application/json" }
                }
            );
        }
        
        // Vérifier si le deviceId existe dans la base de données
        let device = await prisma.device.findUnique({
            where: { deviceId }
        });
        
        // Si l'appareil n'existe pas, l'enregistrer automatiquement
        if (!device) {
            const deviceType = userAgent.includes("iPhone") || userAgent.includes("iPad") || userAgent.includes("iOS")
                ? "IOS"
                : userAgent.includes("Android")
                ? "ANDROID"
                : "UNKNOWN";
            
            try {
                device = await prisma.device.create({
                    data: {
                        deviceId,
                        type: deviceType,
                        ip: req.headers.get("x-forwarded-for") || "unknown",
                        model: null,
                        location: null
                    }
                });
            } catch (error) {
                console.error("Erreur lors de l'enregistrement du device:", error);
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: "DEVICE_REGISTRATION_FAILED",
                        message: "Impossible d'enregistrer l'appareil."
                    }),
                    {
                        status: 500,
                        headers: { "Content-Type": "application/json" }
                    }
                );
            }
        }
        
        const state = generateState();

        const url = await github.createAuthorizationURL(state, {
            scopes: ["user"]
        });
    const cookieCall = await cookies()

        cookieCall.set("state", state, {
            path: "/",
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            maxAge: 600,
            sameSite: "lax",
        });
        
        return Response.redirect(url);
    } catch (error) {
        console.error("Erreur during GitHub signin:", error);
        return new Response(
            JSON.stringify({
                success: false,
                error: "INTERNAL_ERROR",
                message: "Une erreur s'est produite lors de l'authentification."
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" }
            }
        );
    }
}