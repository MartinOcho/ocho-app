import prisma from "@/lib/prisma";
import { github } from "../../auth";
import { generateState } from "arctic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";



export async function GET(req: Request) {
    try {
        // Récupérer le deviceId depuis les headers
        const deviceId = req.headers.get("X-Device-ID");        
        
        
        console.warn(req.headers);

        if (!deviceId) {
            return NextResponse.redirect(
                new URL(`/android/signin/auth-error?error=DEVICE_NOT_REGISTERED&message=Appareil%20non%20enregistr%C3%A9`, req.url)
            );
        }
        
        // Vérifier si le deviceId existe dans la base de données
        let device = await prisma.device.findUnique({
            where: { deviceId }
        });
        
        // Si l'appareil n'existe pas, l'enregistrer automatiquement
        if (!device) {
            const deviceType = "ANDROID";
            
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
                return NextResponse.redirect(
                    new URL(`/android/signin/auth-error?error=DEVICE_REGISTRATION_FAILED&message=Impossible%20d'enregistrer%20l'appareil.`, req.url)
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
        
        return NextResponse.redirect(url);
    } catch (error) {
        console.error("Erreur during GitHub signin:", error);
        return NextResponse.redirect(
            new URL(`/android/signin/auth-error?error=INTERNAL_ERROR&message=Une%20erreur%20interne%20est%20survenue.`, req.url)
        )
    }
}