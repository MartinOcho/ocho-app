import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  ApiResponse,
  Attachment,
  calculateRelevanceScore,
  Post,
  User,
  VerifiedUser,
} from "../../utils/dTypes";
import { getPostDataIncludes, UserData } from "@/lib/types";
import { getCurrentUser } from "../../auth/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  try {
    const { user, message } = await getCurrentUser();
    if (!user) {
      return Response.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      } as ApiResponse<null>);
    }
    

    const [allScores, post] = await prisma.$transaction([
      prisma.postUserScore.findMany({
        where: {
          postId: postId,
        },
        select: {
          userId: true,
          relevanceScore: true,
        },
      }),
      prisma.post.findUnique({
        where: {
          id: postId,
        },
        include: getPostDataIncludes(user.id),
      }),
    ]);

    if (!allScores || !post) {
      return Response.json({}, { status: 404 });
    }

    const newUserScore = calculateRelevanceScore(post, user);

    const postScore =
      newUserScore +
      allScores
        .filter((score) => score.userId !== user.id)
        .reduce((acc, score) => acc + score?.relevanceScore, 0);

    await prisma.$transaction([
      prisma.post.update({
        where: {
          id: postId,
        },
        data: {
          relevanceScore: postScore,
        },
      }),
      prisma.postUserScore.upsert({
        where: {
          postId_userId: {
            postId,
            userId: user.id,
          },
        },
        update: {
          relevanceScore: newUserScore,
        },
        create: {
          postId,
          userId: user.id,
          relevanceScore: newUserScore,
        },
      }),
    ]);
    const userVerifiedData = post.user.verified?.[0];
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
    const attachments: Attachment[] = post.attachments;
    const author: User = {
      id: post.userId,
      username: post.user.username,
      displayName: post.user.displayName,
      avatarUrl: post.user.avatarUrl || undefined,
      bio: post.user.bio || undefined,
      verified,
      createdAt: post.user.createdAt.getTime(),
      lastSeen: post.user.lastSeen.getTime(),
    };
    const createdAt: number = post.createdAt.getTime();
    const content: string = post.content;
    const gradient: number | undefined = post.gradient || undefined;
    const id: string = post.id;
    const likes = post._count.likes;
    const comments = post._count.comments;
    const isLiked = post.likes.some((like) => like.userId === user.id);
    const isBookmarked = post.bookmarks.some(
      (bookmark) => bookmark.userId === user.id,
    );
    const finalPost: Post = {
      id,
      author,
      content,
      createdAt,
      attachments,
      gradient,
      likes,
      comments,
      isLiked,
      isBookmarked,
    };
    return Response.json({
      success: true,
      data: finalPost,
    } as ApiResponse<Post>);
  } catch (error) {
    console.error("Error getting post:", error);
    return Response.json({
      success: false,
      message: "Erreur lors de la récupération du post",
    });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  try {
    const { user, message } = await getCurrentUser();
    if (!user) {
      return Response.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      } as ApiResponse<null>);
    }

    if (!postId) {
      return Response.json({ success: false, message: "ID de post manquant" });
    }

    // On vérifie si l'utilisateur est bien l'auteur du post
    const postToDelete = await prisma.post.findUnique({
      where: {
        id: postId,
      },
    });

    if (!postToDelete) {
      return Response.json(
        { success: false, message: "Post non trouvé" },
        { status: 404 },
      );
    }

    if (postToDelete.userId !== user.id) {
      return Response.json({
        success: false,
        message: "Vous n'avez pas la permission de supprimer ce post",
      });
    }

    await prisma.post.delete({
      where: {
        id: postId,
      },
    });

    return Response.json({
      success: true,
      message: "Post supprimé avec succès",
    });
  } catch (error) {
    console.error("Error deleting post:", error);
    return Response.json({
      success: false,
      message: "Erreur lors de la suppression du post",
    });
  }
}
