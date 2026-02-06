import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getUserDataSelect } from "@/lib/types";



export async function GET(req: Request,
    { params }: { params: Promise<{ username: string }> }
) {
    const {username} = await params
    const postId = new URL(req.url).searchParams.get("postId");
    try {

        const { user: loggedInUser } = await validateRequest();

        if (!loggedInUser) {
            return Response.json({ error: "Action non autorisée" }, { status: 401 })
        }

        const user = await prisma.user.findFirst({
            where: {
                username: {
                    equals: username,
                    mode: "insensitive"
                }
            },
            select: getUserDataSelect(loggedInUser.id)
        });

        if (!user) {
            return Response.json({ error: "Utilisateur non trouvé" }, { status: 404 })
        }
        if (postId) {
            const post = await prisma.post.findUnique({
                where: { id: postId },
                select: { userId: true }
            });
            if (post && post.userId !== user.id) {
                const isIdentified = await prisma.notification.findFirst({
                    where: {
                        issuerId: post.userId,
                        recipientId: user.id,
                        type: "IDENTIFY",
                        postId
                    }
                })
                if (!isIdentified) {
                    await prisma.notification.create({
                        data: {
                            issuerId: post.userId,
                            recipientId: user.id,
                            type: "IDENTIFY",
                            postId
                        }
                    });

                    // Notifier le serveur de sockets via endpoint interne
                    try {
                        await fetch(
                            `${process.env.NEXT_PUBLIC_CHAT_SERVER_URL || "http://localhost:5000"}/internal/create-notification`,
                            {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    "x-internal-secret": process.env.INTERNAL_SERVER_SECRET || "",
                                },
                                body: JSON.stringify({
                                    type: "IDENTIFY",
                                    recipientId: user.id,
                                    issuerId: post.userId,
                                    postId,
                                }),
                            }
                        );
                    } catch (e) {
                        console.warn("Impossible de notifier le serveur de sockets:", e);
                    }
                }
            }
        }

        return Response.json(user)

    } catch (error) {
        console.error(error);
        return Response.json({ error: "Internal server error" }, { status: 500 })
    }
}