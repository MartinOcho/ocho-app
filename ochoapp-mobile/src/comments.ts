import { Request, Response } from "express";
import prisma from "./prisma";
import { Comment, UserData } from "./types";
import { checkVerification, getCurrentUser } from "./auth";
import { createCommentSchema } from "./validation";

export async function sendComment(req: Request, res: Response) {
  try {
    const { postId } = req.params;
    const { user: loggedUser, message } = await getCurrentUser(req.headers);
    if (!loggedUser) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const userId = loggedUser.id;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (!post) {
      return res.json({
        success: false,
        message: "Post not found.",
      });
    }

    const { content: newCContent } = req.body;
    const { content } = createCommentSchema.parse({ content: newCContent });

    const newComment = await prisma.comment.create({
      data: {
        content,
        postId,
        userId,
        type: "COMMENT",
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            verified: {
              select: {
                type: true,
                expiresAt: true,
              },
            },
          },
        },
        post: {
          select: {
            userId: true,
          },
        },
        likes: {
          select: {
            userId: true,
          },
        },
        _count: {
          select: {
            likes: true,
          },
        },
        replies: {
          where: {
            post: {
              userId: post.userId,
            },
          },
          select: {
            id: true,
          },
        },
      },
    });

    const verified = await checkVerification(newComment.user as UserData);

    const commentUser = {
      id: newComment.user.id,
      username: newComment.user.username,
      displayName: newComment.user.displayName,
      avatarUrl: newComment.user.avatarUrl as string | undefined,
      verified,
    };

    const replies = await prisma.comment.count({
      where: {
        firstLevelCommentId: newComment.id,
      },
    });

    const comment: Comment = {
      id: newComment.id,
      author: commentUser,
      content: newComment.content,
      createdAt: newComment.createdAt.getTime(),
      likes: newComment._count.likes,
      isLiked: newComment.likes.some((like) => like.userId === userId),
      isLikedByAuthor: newComment.likes.some(
        (like) => like.userId === newComment.post.userId,
      ),
      isRepliedByAuthor: !!newComment.replies.length,
      postId,
      postAuthorId: newComment.post.userId,
      replies,
    };

    return res.json({
      success: true,
      message: "Comments sent successfully.",
      data: comment,
    });
  } catch (error) {
    console.error(error);
    return res.json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
}

export async function getComments(req: Request, res: Response) {
  const { postId } = req.params;
  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const userId = user.id;

    const pageSize = 5;
    const cursor = req.query.cursor as string | undefined;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (!post) {
      return res.json({
        success: false,
        message: "Post not found.",
      });
    }

    const commentsFromdb = await prisma.comment.findMany({
      where: { postId, firstLevelCommentId: null },
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
      cursor: cursor ? { id: cursor } : undefined,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            verified: {
              select: {
                type: true,
                expiresAt: true,
              },
            },
          },
        },
        likes: {
          where: { userId },
          select: { userId: true },
        },
        _count: {
          select: {
            likes: true,
          },
        },
        replies: {
          where: {
            post: {
              userId: post.userId,
            },
          },
          select: {
            id: true,
          },
        },
      },
    });

    const comments = await Promise.all(
      commentsFromdb.map(async (comment) => {
        const verified = await checkVerification(comment.user as UserData);

        const commentUser = {
          id: comment.user.id,
          username: comment.user.username,
          displayName: comment.user.displayName,
          avatarUrl: comment.user.avatarUrl,
          verified,
        };

        const replies = await prisma.comment.count({
          where: {
            firstLevelCommentId: comment.id,
          },
        });

        return {
          id: comment.id,
          author: commentUser,
          content: comment.content,
          createdAt: comment.createdAt.getTime(),
          likes: comment._count.likes,
          isLiked: comment.likes.length > 0,
          isLikedByAuthor: comment.likes.some(
            (like) => like.userId === post.userId,
          ),
          isRepliedByAuthor: !!comment.replies.length,
          postId,
          postAuthorId: post.userId,
          replies,
        } as Comment;
      }),
    );

    const nextCursor =
      commentsFromdb.length > pageSize ? commentsFromdb[pageSize].id : null;

    const responseData = {
      comments: comments.slice(0, pageSize),
      nextCursor,
    };

    return res.json({
      success: true,
      message: "Comments retrieved successfully.",
      data: responseData,
    });
  } catch (error) {
    console.error(error);
    return res.json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
}

export async function deleteComment(req: Request, res: Response) {
  const { commentId } = req.params;
  try {
    const { user: loggedUser, message } = await getCurrentUser(req.headers);
    if (!loggedUser) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }

    const userId = loggedUser.id;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true },
    });
    if (!comment) {
      return res.json({
        success: false,
        message: "Comment not found.",
        name: "not_found",
      });
    }
    if (comment.userId !== userId) {
      return res.json({
        success: false,
        message: "Forbidden: You can only delete your own comments.",
        name: "forbidden",
      });
    }
    await prisma.comment.delete({
      where: { id: commentId },
    });
    return res.json({
      success: true,
      message: "Comment deleted successfully.",
    });
  } catch (error) {
    console.error(error);
    return res.json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  
  }
}
export async function getCommentReplies(req: Request, res: Response) {
  const { commentId } = req.params;
  try {
    const { user: loggedUser, message } = await getCurrentUser(req.headers);
    if (!loggedUser) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      });
    }
    const userId = loggedUser.id;

    const pageSize = 3;
    const cursor = req.query.cursor as string | undefined;

    const comments = await prisma.comment.findMany({
      where: { firstLevelCommentId: commentId },
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
      cursor: cursor ? { id: cursor } : undefined,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            verified: {
              select: {
                type: true,
                expiresAt: true,
              },
            },
          },
        },
        post: {
          select: {
            userId: true,
          },
        },
        likes: {
          select: {
            userId: true,
          },
        },
        _count: {
          select: {
            likes: true,
            replies: true,
          },
        },
        firstLevelComment: {
          select: {
            userId: true,
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                verified: {
                  select: {
                    type: true,
                    expiresAt: true,
                  },
                },
              },
            },
          },
        },
        comment: {
          select: {
            userId: true,
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                verified: {
                  select: {
                    type: true,
                    expiresAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const replies = comments.map((comment) => {
      const verified = checkVerification(comment.user as UserData);

      const commentUser = {
        id: comment.user.id,
        username: comment.user.username,
        displayName: comment.user.displayName,
        avatarUrl: comment.user.avatarUrl,
        verified,
      };
      const id = comment.id;
      const author = commentUser;
      const content = comment.content;
      const createdAt = comment.createdAt.getTime();
      const likes = comment._count.likes;
      const isLiked = comment.likes.some((like) => like.userId === userId);
      const isLikedByAuthor = comment.likes.some((like) => like.userId === comment.post.userId);
      const postId = comment.postId;
      const postAuthorId = comment.post.userId;
      const repliesCount = comment._count.replies;
      const firstLevelCommentId = comment.firstLevelCommentId!;
      const firstLevelCommentAuthorId = comment.firstLevelComment!.userId;
      const commentId = comment.commentId;
      const commentAuthorId = comment.comment!.userId;

      const commentAuthorVerified = checkVerification(comment.comment!.user as UserData);
      const commentAuthor = {
        id: comment.comment!.user.id,
        username: comment.comment!.user.username,
        displayName: comment.comment!.user.displayName,
        avatarUrl: comment.comment!.user.avatarUrl,
        verified: commentAuthorVerified,
      };

      return {
        id,
        author,
        content,
        createdAt,
        likes,
        isLiked,
        isLikedByAuthor,
        postId,
        postAuthorId,
        replies: repliesCount,
        firstLevelCommentId,
        firstLevelCommentAuthorId,
        commentId,
        commentAuthorId,
        commentAuthor,
      };
    });

    const nextCursor = comments.length > pageSize ? comments[pageSize].id : null;
    const repliesPage = {
      replies,
      nextCursor,
    };

    return res.json({
      success: true,
      message: "Replies retrieved successfully.",
      data: repliesPage,
    });
  } catch (error) {
    console.error(error);
    return res.json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
}