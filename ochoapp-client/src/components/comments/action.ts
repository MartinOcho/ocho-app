"use server";

import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { CommentData, FirstCommentData, getCommentDataIncludes, PostData } from "@/lib/types";
import { createCommentSchema } from "@/lib/validation";
import kyInstance from "@/lib/ky";

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

  // Notifier le serveur de sockets pour que le destinataire recoive la notification
  if (user.id !== post.userId) {
    try {
      await kyInstance(
        `${process.env.NEXT_PUBLIC_CHAT_SERVER_URL || "http://localhost:5000"}/internal/create-notification`,
        {
          method: "POST",
          headers: {
            "x-internal-secret": process.env.INTERNAL_SERVER_SECRET || "",
          },
          json: {
            type: "COMMENT",
            recipientId: post.userId,
            issuerId: user.id,
            postId: post.id,
            commentId: newComment.id,
          },
        }
      );
    } catch (e) {
      console.warn("Impossible de notifier le serveur de sockets:", e);
    }
  }

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

  // Notifier le serveur de sockets pour que le destinataire recoive la notification
  if (user.id !== comment.userId) {
    try {
      await kyInstance(
        `${process.env.NEXT_PUBLIC_CHAT_SERVER_URL || "http://localhost:5000"}/internal/create-notification`,
        {
          method: "POST",
          headers: {
            "x-internal-secret": process.env.INTERNAL_SERVER_SECRET || "",
          },
          json: {
            type: "COMMENT_REPLY",
            recipientId: comment.userId,
            issuerId: user.id,
            postId: firstLevelComment.postId,
            commentId: newComment.id,
          },
        }
      );
    } catch (e) {
      console.warn("Impossible de notifier le serveur de sockets:", e);
    }
  }

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

  // Notifier le serveur de sockets pour supprimer les notifications liées à ce commentaire
  try {
    // Supprimer les notifications COMMENT et COMMENT_LIKE associées au commentaire
    await Promise.all([
      kyInstance(
        `${process.env.NEXT_PUBLIC_CHAT_SERVER_URL || "http://localhost:5000"}/internal/delete-notifications-for-comment`,
        {
          method: "POST",
          headers: {
            "x-internal-secret": process.env.INTERNAL_SERVER_SECRET || "",
          },
          json: {
            commentId: id,
            postId: comment.postId,
          },
        }
      ),
    ]);
  } catch (e) {
    console.warn("Impossible de notifier le serveur de sockets:", e);
  }

  return deletedComment;
}
