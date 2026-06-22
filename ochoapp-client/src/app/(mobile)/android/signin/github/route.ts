import prisma from "@/lib/prisma";
import { github } from "../../auth";
import { generateState } from "arctic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";



export async function GET(req: Request) {
    try {
        // Récupérer les paramètres depuis l'URL (Query Parameters)
        const url = new URL(req.url);
        const deviceId = url.searchParams.get("device_id") || req.headers.get("X-Device-ID");
        const deviceType = url.searchParams.get("device_type") || req.headers.get("X-Device-Type") || "ANDROID";
        const deviceModel = url.searchParams.get("device_model") || req.headers.get("X-Device-Model") || null;
        
        console.warn("Device info:", { deviceId, deviceType, deviceModel });

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
            try {
                device = await prisma.device.create({
                    data: {
                        deviceId,
                        type: deviceType as any,
                        ip: req.headers.get("x-forwarded-for") || "unknown",
                        model: deviceModel,
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

        const url_github = await github.createAuthorizationURL(state, ["user"]);

        const cookieCall = await cookies()

        // 🔑 CRUCIAL: Stocker les infos du device dans des cookies sécurisés
        // Ces données seront lues au retour de GitHub pour finaliser la session
        cookieCall.set("device_id", deviceId, {
            path: "/",
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            maxAge: 600,
            sameSite: "lax",
        });
        
        cookieCall.set("device_type", deviceType, {
            path: "/",
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            maxAge: 600,
            sameSite: "lax",
        });

        if (deviceModel) {
            cookieCall.set("device_model", deviceModel, {
                path: "/",
                secure: process.env.NODE_ENV === "production",
                httpOnly: true,
                maxAge: 600,
                sameSite: "lax",
            });
        }

        cookieCall.set("state", state, {
            path: "/",
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            maxAge: 600,
            sameSite: "lax",
        });
        
        return NextResponse.redirect(url_github);
    } catch (error) {
        console.error("Erreur during GitHub signin:", error);
        return NextResponse.redirect(
            new URL(`/android/signin/auth-error?error=INTERNAL_ERROR&message=Une%20erreur%20interne%20est%20survenue.`, req.url)
        )
    }
}