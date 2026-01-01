import { google } from "@/auth";
import { generateCodeVerifier, generateState } from "arctic";
import { cookies } from "next/headers";



export async function GET() {
    const state = generateState();
    const codeVerifier = generateCodeVerifier();


    const url = await google.createAuthorizationURL(state, codeVerifier, {
        scopes: ["profile", "email"]
    });
    const cookieCall = await cookies()

    cookieCall.set("state", state, {
        path: "/",
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 600,
        sameSite: "lax",
    });
    cookieCall.set("code_verifier", codeVerifier, {
        path: "/",
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 600,
        sameSite: "lax",
    });
    
    return Response.redirect(url)
}