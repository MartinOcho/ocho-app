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
                    })
                }
            }
        }

        return Response.json(user)

    } catch (error) {
        console.error(error);
        return Response.json({ error: "Internal server error" }, { status: 500 })
    }
}