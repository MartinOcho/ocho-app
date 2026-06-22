import { github } from "@/auth";
import { generateState } from "arctic";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
    const state = generateState();
    const switching =
        req.nextUrl.searchParams.get("switching") === "true" ||
        req.nextUrl.searchParams.get("switching") === "1";


    const url = await github.createAuthorizationURL(state, ["user"]);
    const cookieCall = await cookies()

    cookieCall.set("state", state, {
        path: "/",
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 900,
        sameSite: "lax",
    });
    cookieCall.set(
        "oauth_switching",
        switching ? "true" : "false",
        {
            path: "/",
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            maxAge: 900,
            sameSite: "lax",
        },
    );

    return Response.redirect(url);
}