// components/posts/editor/action.ts
"use server" 

import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getPostDataIncludes } from "@/lib/types";
import { createPostSchema } from "@/lib/validation";

export async function submitPost(input: {
    content: string;
    mediaIds: string[];
    gradient?: number;
}) {
    const { user } = await validateRequest();

    if (!user) {
        throw new Error("Action non autorisée");
    }

    const { content, mediaIds, gradient } = createPostSchema.parse(input);
    

    const newPost = await prisma.post.create({
        data: {
            content,
            userId: user.id,
            gradient,
            attachments: {
                connect: mediaIds.map(id => ({ id }))
            }
        },
        include: getPostDataIncludes(user.id),
    });

    return newPost;
}
