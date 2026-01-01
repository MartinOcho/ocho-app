import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { createCommentSchema } from "@/lib/validation";
import { getCommentDataIncludes } from "@/lib/types";
import { ApiResponse, Reply, User, VerifiedUser } from "../../../utils/dTypes";
import { getCurrentUser } from "../../../auth/utils";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const { commentId } = await params;
  // Lire le corps de la requête UNE SEULE FOIS au début
  let body;
  try {
    body = await req.json() as Reply;
  } catch (e) {
    console.error("Erreur lors de la lecture du corps de la requête (JSON invalide):", e);
    return NextResponse.json({
      success: false,
      message: "Requête invalide: le corps doit être un JSON valide.",
    } as ApiResponse<null>);
  }

  try {
      const { user, message } = await getCurrentUser();
      if (!user) {
        return NextResponse.json({
          success: false,
          message: message || "Utilisateur non authentifié.",
          name: "unauthorized",
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
        return NextResponse.json({
          success: false,
          message: "Post not found.",
        } as ApiResponse<null>);
      }

      // NOUVEAUTÉ : Vérification de l'existence du commentaire parent (commentId)
      const parentComment = await prisma.comment.findUnique({
        where: { id: commentId || undefined },
        select: { id: true }
      });

      if (!parentComment) {
        return NextResponse.json({
            success: false,
            message: "Commentaire parent spécifié ('commentId') n'existe pas.",
            name: "foreign_key_violation", // Nom plus explicite pour l'erreur
        } as ApiResponse<null>);
      }
      // FIN NOUVEAUTÉ
      
      const { content: validatedContent } = createCommentSchema.parse({content});
  
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
            }
          },
          comment: {
            select: {
              user: true,
            }
          }
        },
      });
  
      
      const replyUser = toUser(newReply.user);
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

      const commentAuthor = toUser(newReply.comment?.user);
  
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
      
  
      return NextResponse.json({
        success: true,
        message: "Comments sent successfully.",
        data: reply,
      } as ApiResponse<Reply>);
    } catch (error) {
      console.error(error);
      return NextResponse.json({
        success: false,
        message: "Something went wrong. Please try again.",
      } as ApiResponse<null>);
    }
}


function toUser(user: any): User {
      const userVerifiedData = user.verified?.[0];
  
      const expiresAt = userVerifiedData?.expiresAt?.getTime() || null;
      const canExpire = !!(expiresAt || null);
  
      const expired =
        canExpire && expiresAt ? new Date().getTime() < expiresAt : false;
  
      const isVerified = !!userVerifiedData && !expired;
  
      const verified: VerifiedUser = {
        verified: isVerified,
        type: userVerifiedData?.type,
        expiresAt,
      };
  
      return {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        verified,
      } as User;
}
