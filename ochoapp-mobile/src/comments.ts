import { Request, Response } from "express";
import prisma from "./prisma";
import {
  ApiResponse,
  Comment,
  getCommentDataIncludes,
  getUserDataSelect,
  LikeResponse,
  Reply,
  UserData,
} from "./types";
import { checkVerification, formatUserResponse, getCurrentUser } from "./auth";
import { createCommentSchema } from "./validation";

export async function sendComment(req: Request, res: Response) {
  try {
    const { postId } = req.params;
    const { user: loggedUser, message } = await getCurrentUser(req.headers);
    if (!loggedUser) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "invalid_session",
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
    const postAuthorId = newComment.post.userId;
    const isRepliedByAuthor =
      (await prisma.comment.findFirst({
        where: {
          firstLevelCommentId: newComment.id,
          userId: postAuthorId,
        },
      })) != null;

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
      isRepliedByAuthor,
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
        name: "invalid_session",
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
        post: {
          select: {
            userId: true,
          },
        },
        user: {
          select: getUserDataSelect(userId),
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

        const postAuthorId = comment.post.userId;

        const isRepliedByAuthor =
          (await prisma.comment.findFirst({
            where: {
              firstLevelCommentId: comment.id,
              userId: postAuthorId,
            },
          })) != null;

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
          isRepliedByAuthor,
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

export async function sendCommentReply(req: Request, res: Response) {
  // Lire le corps de la requête UNE SEULE FOIS au début
  let body;
  try {
    body = req.body as Reply;
  } catch (e) {
    console.error(
      "Erreur lors de la lecture du corps de la requête (JSON invalide):",
      e,
    );
    return res.json({
      success: false,
      message: "Requête invalide: le corps doit être un JSON valide.",
    } as ApiResponse<null>);
  }

  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "invalid_session",
      } as ApiResponse<null>);
    }
    // Fin de la vérification de l'appareil

    const userId = user.id;

    // Utiliser le corps lu une seule fois (body)
    const { postId, firstLevelCommentId, content, commentId } = body;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (!post) {
      return res.json({
        success: false,
        message: "Post not found.",
      } as ApiResponse<null>);
    }

    // NOUVEAUTÉ : Vérification de l'existence du commentaire parent (commentId)
    const parentComment = await prisma.comment.findUnique({
      where: { id: commentId || undefined },
      select: { id: true },
    });

    if (!parentComment) {
      return res.json({
        success: false,
        message: "Commentaire parent spécifié ('commentId') n'existe pas.",
        name: "foreign_key_violation", // Nom plus explicite pour l'erreur
      } as ApiResponse<null>);
    }
    // FIN NOUVEAUTÉ

    const { content: validatedContent } = createCommentSchema.parse({
      content,
    });

    const newReply = await prisma.comment.create({
      data: {
        // On utilise 'content' qui vient de la déstructuration de 'body'
        content: validatedContent,
        postId,
        userId,
        firstLevelCommentId,
        commentId, // commentId est maintenant validé et connu pour exister
        type: "REPLY",
      },
      include: {
        ...getCommentDataIncludes(userId),
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
        firstLevelComment: {
          select: {
            user: true,
          },
        },
        comment: {
          select: {
            user: true,
          },
        },
      },
    });

    const replyUser = await formatUserResponse(newReply.user);
    const id = newReply.id;
    const author = replyUser;
    const newContent = newReply.content;
    const createdAt = newReply.createdAt.getTime();
    const likes = newReply._count.likes;
    const isLiked = newReply.likes.some((like) => like.userId === userId);
    const isLikedByAuthor = newReply.likes.some(
      (like) => like.userId === newReply.post.userId,
    );
    const postAuthorId = newReply.post.userId;
    const replies = await prisma.comment.count({
      where: {
        firstLevelCommentId: newReply.firstLevelCommentId,
      },
    });

    if (!newReply.comment?.user) {
      return res.json({
        success: false,
        message: "L'utilisateur du commentaire parent n'a pas été trouvé.",
        name: "foreign_key_violation",
      } as ApiResponse<null>);
    }

    const commentAuthor = await formatUserResponse(
      newReply.comment.user as unknown as UserData,
    );

    const reply: Reply = {
      id,
      author,
      content: newContent,
      createdAt,
      likes,
      isLiked,
      isLikedByAuthor,
      postId,
      postAuthorId,
      replies,
      firstLevelCommentId,
      firstLevelCommentAuthorId: newReply.firstLevelComment?.user.id || null,
      commentId: newReply.commentId,
      commentAuthorId: commentAuthor ? commentAuthor.id : null,
      commentAuthor,
    };

    console.log(reply);

    return res.json({
      success: true,
      message: "Comments sent successfully.",
      data: reply,
    } as ApiResponse<Reply>);
  } catch (error) {
    console.error(error);
    return res.json({
      success: false,
      message: "Something went wrong. Please try again.",
    } as ApiResponse<null>);
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
        name: "invalid_session",
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
      const isLikedByAuthor = comment.likes.some(
        (like) => like.userId === comment.post.userId,
      );
      const postId = comment.postId;
      const postAuthorId = comment.post.userId;
      const repliesCount = comment._count.replies;
      const firstLevelCommentId = comment.firstLevelCommentId!;
      const firstLevelCommentAuthorId = comment.firstLevelComment!.userId;
      const commentId = comment.commentId;
      const commentAuthorId = comment.comment!.userId;

      const commentAuthorVerified = checkVerification(
        comment.comment!.user as UserData,
      );
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

    const nextCursor =
      comments.length > pageSize ? comments[pageSize].id : null;
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

export async function likeComment(req: Request, res: Response) {
  const { commentId } = req.params;

  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "invalid_session",
      } as ApiResponse<null>);
    }

    const userId = user.id;
    let isLiked = false;

    // Utilise une transaction pour garantir que les opérations sont atomiques
    await prisma.$transaction(async (prisma) => {
      const existingLike = await prisma.commentLike.findFirst({
        where: { commentId, userId: userId },
      });

      if (existingLike) {
        // Si le like existe, on le supprime
        await prisma.commentLike.delete({
          where: {
            userId_commentId: { userId, commentId },
          },
        });
        isLiked = false;
      } else {
        const comment = await prisma.comment.findUnique({
          where: { id: commentId },
          select: { postId: true, userId: true },
        });
        if (!comment) {
          return res.json({
            success: false,
            message: "Comment not found.",
            name: "not_found",
          } as ApiResponse<null>);
        }
        // Sinon, on le crée
        await prisma.commentLike.create({
          data: {
            commentId,
            userId,
          },
        });

        // Crée une notification si l'utilisateur n'est pas l'auteur du post
        const post = await prisma.post.findUnique({
          where: { id: comment.postId },
          select: { userId: true },
        });

        if (post && post.userId !== userId) {
          await prisma.notification.create({
            data: {
              issuerId: userId,
              recipientId: post.userId,
              postId: comment.postId,
              commentId,
              type: "COMMENT_LIKE",
            },
          });
        }
        isLiked = true;
      }
    });

    // Compte le nombre de likes après la transaction
    const likesCount = await prisma.commentLike.count({
      where: { commentId },
    });

    return res.json({
      success: true,
      message: "Like action successful.",
      data: { isLiked, likes: likesCount },
    } as ApiResponse<LikeResponse>);
  } catch (error) {
    console.error("Error in like endpoint:", error);
    return res.json({
      success: false,
      message: "Something went wrong. Please try again.",
    } as ApiResponse<null>);
  }
}

export async function deleteComment(req: Request, res: Response) {
  const { commentId } = req.params;

  try {
    const { user, message } = await getCurrentUser(req.headers);
    if (!user) {
      return res.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "invalid_session",
      } as ApiResponse<null>);
    }

    const userId = user.id;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true },
    });
    if (!comment) {
      return res.json({
        success: false,
        message: "Comment not found.",
        name: "not_found",
      } as ApiResponse<null>);
    }
    if (comment.userId !== userId) {
      return res.json({
        success: false,
        message: "Forbidden: You can only delete your own comments.",
        name: "forbidden",
      } as ApiResponse<null>);
    }
    await prisma.comment.delete({
      where: { id: commentId },
    });
    return res.json({
      success: true,
      message: "Comment deleted successfully.",
    } as ApiResponse<null>);
  } catch (error) {}
  return res.json({
    success: true,
    message: "Replies endpoint is operational.",
  } as ApiResponse<null>);
}
