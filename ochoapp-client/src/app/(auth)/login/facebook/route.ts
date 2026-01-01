import { facebook } from "@/auth";
import { generateState } from "arctic";
import { cookies } from "next/headers";



export async function GET() {
    const state = generateState();


    const url = await facebook.createAuthorizationURL(state, {
        scopes: ["public_profile", "email"]
    });
    const cookieCall = await cookies()

    cookieCall.set("state", state, {
        path: "/",
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 600,
        sameSite: "lax",
    });
    
    return Response.redirect(url)
}