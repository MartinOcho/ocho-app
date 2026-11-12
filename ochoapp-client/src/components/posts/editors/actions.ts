// components/posts/editor/action.ts
"use server" 

import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getPostDataIncludes } from "@/lib/types";
import { createPostSchema, updatePostSchema } from "@/lib/validation";

export async function submitPost(input: {
  content: string;
  mediaIds: string[];
  gradient?: number | null;
  visibility?: "PUBLIC" | "FOLLOWERS" | "PRIVATE";
  commentPolicy?: "EVERYONE" | "FOLLOWERS" | "NO_ONE";
}) {
  const { user } = await validateRequest();

  if (!user) {
    throw new Error("Action non autorisée");
  }

  const { content, mediaIds, gradient, visibility, commentPolicy } =
    createPostSchema.parse(input);

  const newPost = await prisma.post.create({
    data: {
      content,
      userId: user.id,
      gradient,
      visibility,
      commentPolicy,
      attachments: {
        connect: mediaIds.map((id) => ({ id })),
      },
    },
    include: getPostDataIncludes(user.id),
  });

  return newPost;
}

export async function updatePost(input: {
  id: string;
  content: string;
  gradient: number | null;
  visibility: "PUBLIC" | "FOLLOWERS" | "PRIVATE";
  commentPolicy: "EVERYONE" | "FOLLOWERS" | "NO_ONE";
}) {
  const { user } = await validateRequest();
  if (!user) {
    throw new Error("Action non autorisée");
  }

  const values = updatePostSchema.parse(input);
  const existingPost = await prisma.post.findUnique({
    where: { id: values.id },
    select: { userId: true, attachments: { select: { id: true }, take: 1 } },
  });

  if (!existingPost || existingPost.userId !== user.id) {
    throw new Error("Action non autorisée");
  }
  if (!values.content && !existingPost.attachments.length) {
    throw new Error("Une publication doit contenir du texte ou un média");
  }

  return prisma.post.update({
    where: { id: values.id },
    data: {
      content: values.content,
      gradient: values.gradient,
      visibility: values.visibility,
      commentPolicy: values.commentPolicy,
      editedAt: new Date(),
    },
    include: getPostDataIncludes(user.id),
  });
}
