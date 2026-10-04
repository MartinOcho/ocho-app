import prisma from "@/lib/prisma";
import { getPostDataIncludes } from "@/lib/types";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";

export const getPost = cache(
  async (postId: string, loggedInUserId: string, targetComment?: string) => {
    const postUser = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        user: true,
      },
    });
    const username = postUser?.user.username;
    const post = await prisma.post.findFirst({
      where: {
        AND: [
          { id: postId },
          {
            OR: [
              {
                userId: loggedInUserId,
              },
              {
                visibility: "FOLLOWERS",
                user: {
                  followers: {
                    some: {
                      followerId: loggedInUserId,
                    },
                  },
                },
              },
              {
                visibility: "PUBLIC",
              },
            ],
          },
        ],
      },
      include: getPostDataIncludes(loggedInUserId, username),
    });

    if (!post) notFound();

    if (targetComment) {
      const commentExists = await prisma.comment.findFirst({
        where: { id: targetComment, postId },
      });

      if (!commentExists) {
        redirect(`/posts/${postId}`);
      }
    }

    return post;
  },
);
