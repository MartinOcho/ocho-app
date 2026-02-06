import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getUserDataSelect } from "@/lib/types";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
        const pageSize = 10; // Définissez la taille de la page

        // Valider la requête et obtenir l'utilisateur connecté
        const { user } = await validateRequest();

        if (!user) {
            return Response.json({ error: "Action non autorisée" }, { status: 401 });
        }

        // Récupérer les amis paginés
        const friends = await prisma.user.findMany({
            where: {
                AND: [
                    { followers: { some: { followerId: user.id } } },
                    { following: { some: { followingId: user.id } } },
                ],
            },
            take: pageSize + 1, // Prendre un élément supplémentaire pour vérifier s'il y a une page suivante
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: { id: 'asc' },
            select: getUserDataSelect(user.id),
        });

        const nextCursor = friends.length > pageSize ? friends[pageSize].id : null;
        const friendsPage = friends.length > pageSize ? friends.slice(0, pageSize) : friends;

        return Response.json({ users: friendsPage, nextCursor });
        
    } catch (error) {
        console.error(error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
    }
}
