import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";

export async function PATCH() {
    try {

        const {user} = await validateRequest();

        if(!user){
            return Response.json({error: "Action non autorisée"}, {status: 401})
        }

        await prisma.notification.updateMany({
            where: {
                recipientId: user.id,
                read: false,
            },
            data: {
                read: true
            }
        });

        // Notifier le serveur de sockets en temps réel
        try {
            await fetch(
                `${process.env.NEXT_PUBLIC_CHAT_SERVER_URL || "http://localhost:5000"}/internal/mark-all-notifications-as-read`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-internal-secret": process.env.INTERNAL_SERVER_SECRET || "",
                    },
                    body: JSON.stringify({
                        recipientId: user.id,
                    }),
                }
            );
        } catch (e) {
            console.warn("Impossible de notifier le serveur de sockets:", e);
        }

        return new Response();
        
    } catch (error) {
        console.error(error);
        return Response.json({error: "Internal server error"},  {status: 500})
    }
}