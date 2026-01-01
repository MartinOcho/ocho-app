import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getUserDataSelect } from "@/lib/types";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
        const pageSize = 3;

        const { user } = await validateRequest();

        if (!user) {
            return Response.json({ error: "Action non autorisée" }, { status: 401 });
        }

        // Récupérer des suggestions (utilisateurs non suivis et ne suivant pas l'utilisateur)
        const suggestions = await prisma.user.findMany({
            where: {
                AND: [
                    { followers: { none: { followerId: user.id } } },
                    { following: { none: { followingId: user.id } } },
                    {id: {not: user.id}}
                ],
            },
            take: pageSize + 1,
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: { id: 'asc' },
            select: getUserDataSelect(user.id),
        });

        const nextCursor = suggestions.length > pageSize ? suggestions[pageSize].id : null;
        const suggestionsPage = suggestions.length > pageSize ? suggestions.slice(0, pageSize) : suggestions;

        return Response.json({ users: suggestionsPage, nextCursor });
        
    } catch (error) {
        console.error(error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
    }
}
