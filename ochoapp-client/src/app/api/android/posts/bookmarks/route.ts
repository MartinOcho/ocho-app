import prisma from "@/lib/prisma";
import { getPostDataIncludes } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";
import {
  ApiResponse,
  Post,
  PostsPage,
  User,
  VerifiedUser,
} from "../../utils/dTypes";
import { getCurrentUser } from "../../auth/utils";

export async function GET(req: NextRequest) {
  try {
    const { user, message } = await getCurrentUser();
    if (!user) {
      return NextResponse.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      } as ApiResponse<null>);
    }
    const currentUserId = user.id;

    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
    const pageSize = 5;

    // Récupérer les favoris de l'utilisateur
    const bookmarks = await prisma.bookmark.findMany({
      where: {
        userId: currentUserId,
      },
      // Inclure les données du post et de l'auteur pour chaque favori
      include: {
        post: {
          include: getPostDataIncludes(currentUserId),
        },
      },
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
      cursor: cursor ? { id: cursor } : undefined,
    });

    // Extraire les posts des objets de favoris
    const posts = bookmarks.map((bookmark) => bookmark.post);

    // Convertir les posts pour correspondre au type 'Post'
    const finalPosts = posts.slice(0, pageSize).map((post) => {
      const userVerifiedData = post.user.verified?.[0];

      const expiresAt = userVerifiedData?.expiresAt?.getTime() || null;
      const canExpire = !!(expiresAt || null);

      const expired =
        canExpire && expiresAt ? new Date().getTime() < expiresAt : false;

      const isVerified = !!userVerifiedData && !expired;
      const isBookmarked = post.bookmarks.some(
        (bookmark) => bookmark.userId === currentUserId,
      );

      const verified: VerifiedUser = {
        verified: isVerified,
        type: userVerifiedData?.type,
        expiresAt,
      };

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

      const finalPost: Post = {
        id: post.id,
        author,
        content: post.content,
        createdAt: post.createdAt.getTime(),
        attachments: post.attachments,
        gradient: post.gradient || undefined,
        likes: post._count.likes,
        comments: post._count.comments,
        isLiked: post.likes.some((like) => like.userId === currentUserId),
        isBookmarked,
      };
      return finalPost;
    });

    const nextCursor =
      bookmarks.length > pageSize ? bookmarks[pageSize].id : null;

    const postsData: PostsPage = {
      posts: finalPosts,
      nextCursor,
    };

    return NextResponse.json({
      success: true,
      message: "Favoris récupérés avec succès",
      data: postsData,
    } as ApiResponse<PostsPage>);
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      success: false,
      message: "Erreur interne du serveur",
      name: "server-error",
      data: null,
    } as ApiResponse<null>);
  }
}
