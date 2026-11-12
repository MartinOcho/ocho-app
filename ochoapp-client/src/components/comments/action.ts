"use server";

import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { CommentData, FirstCommentData, getCommentDataIncludes, PostData } from "@/lib/types";
import { createCommentSchema } from "@/lib/validation";

async function assertCanComment(postId: string, userId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      userId: true,
      commentPolicy: true,
      user: {
        select: {
          followers: {
            where: { followerId: userId },
            select: { followerId: true },
          },
        },
      },
    },
  });

  if (!post) {
    throw new Error("Publication introuvable");
  }
  if (
    post.commentPolicy === "NO_ONE" ||
    (post.commentPolicy === "FOLLOWERS" &&
      post.userId !== userId &&
      !post.user.followers.length)
  ) {
    throw new Error("Vous ne pouvez pas commenter cette publication");
  }
}

export async function submitComment({
  post,
  content,
}: {
  post: PostData;
  content: string;
}) {
  const { user } = await validateRequest();

  if (!user) {
    throw new Error("Action non autorisée");
  }

  const { content: validatedContent } = createCommentSchema.parse({ content });
  await assertCanComment(post.id, user.id);

  const newComment = await prisma.comment.create({
    data: {
      content: validatedContent,
      postId: post.id,
      userId: user.id,
    },
    include: getCommentDataIncludes(user.id),
  });

  return newComment;
}
export interface SubmitReply {
  comments: { comment: CommentData; firstLevelComment: FirstCommentData | null };
  content: string;
}
export async function submitReply({
  comments: { comment, firstLevelComment },
  content,
}: SubmitReply) {
  const { user } = await validateRequest();

  if (!user) {
    throw new Error("Action non autorisée");
  }
  if (!firstLevelComment) {
    throw new Error("Vous ne pouvez pas repondre a ce commentaire");
  }

  const { content: validatedContent } = createCommentSchema.parse({ content });
  await assertCanComment(firstLevelComment.postId, user.id);

  const newComment = await prisma.comment.create({
    data: {
      content: validatedContent,
      postId: firstLevelComment.postId,
      firstLevelCommentId: firstLevelComment.id,
      commentId: comment.id,
      userId: user.id,
      type: "REPLY",
    },
    include: getCommentDataIncludes(user.id),
  });
  return newComment;
}

export async function updateComment(input: { id: string; content: string }) {
  const { user } = await validateRequest();
  if (!user) {
    throw new Error("Action non autorisée");
  }

  const { id, content } = input;
  const { content: validatedContent } = createCommentSchema.parse({ content });
  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!comment || comment.userId !== user.id) {
    throw new Error("Action non autorisée");
  }

  return prisma.comment.update({
    where: { id },
    data: { content: validatedContent, editedAt: new Date() },
    include: getCommentDataIncludes(user.id),
  });
}

export async function deleteComment(id: string) {
  const { user } = await validateRequest();

  if (!user) {
    throw new Error("Action non autorisée");
  }

  const comment = await prisma.comment.findUnique({
    where: { id },
  });
  if (!comment) {
    throw new Error("Commentaire non trouve");
  }
  if (comment.userId !== user.id) {
    throw new Error("Action non autorisée");
  }

  const deletedComment = await prisma.comment.delete({
    where: { id },
    include: getCommentDataIncludes(user.id),
  });

  return deletedComment;
}
