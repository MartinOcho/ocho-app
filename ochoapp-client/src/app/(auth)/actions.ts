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