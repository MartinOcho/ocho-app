"use server";

import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getPostDataIncludes } from "@/lib/types";

export async function deletePost(id: string) {
    const { user } = await validateRequest();

    if (!user) {
        throw new Error("Action non autorisée");
    }
    
    const post = await prisma.post.findUnique({
        where: { id }
    });

    if (!post) {
        throw new Error("Post non trouve");
    }

    if (post.userId !== user.id) {
        throw new Error("Action non autorisée");
    }

    const deletedPost = await prisma.post.delete({
        where: { id },
        include: getPostDataIncludes(user.id)
    });

    return deletedPost
}
