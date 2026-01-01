"use server";

import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { CommentData, FirstCommentData, getCommentDataIncludes, PostData } from "@/lib/types";
import { createCommentSchema } from "@/lib/validation";

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

  const newComment = await prisma.comment.create({
    data: {
      content: validatedContent,
      postId: post.id,
      userId: user.id,
    },
    include: getCommentDataIncludes(user.id),
  });

  user.id !== post.userId &&
    (await prisma.notification.create({
      data: {
        issuerId: user.id,
        recipientId: post.userId,
        postId: post.id,
        commentId: newComment.id,
        type: "COMMENT",
      },
    }));

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

  user.id !== comment.userId &&
    (await prisma.notification.create({
      data: {
        issuerId: user.id,
        recipientId: comment.userId,
        postId: firstLevelComment.postId,
        commentId: newComment.id,
        type: "COMMENT_REPLY",
      },
    }));

  return newComment;
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
