
import prisma from "@/lib/prisma";
import { getPostDataIncludes, UserData } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";
import {
  ApiResponse,
  Attachment,
  calculateRelevanceScore,
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

    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
    const pageSize = 5;

    // Récupérer les trois derniers posts triés par date
    const latestPosts = await prisma.post.findMany({
      include: getPostDataIncludes(user.id),
      orderBy: {
        createdAt: "desc",
      },
      take: !cursor ? 3 : 0,
    });

    // Récupérer les posts suivants triés par pertinence
    const relevantPosts = await prisma.post.findMany({
      include: getPostDataIncludes(user.id),
      orderBy: [
        {
          relevanceScore: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      take: pageSize + 1,
      cursor: cursor ? { id: cursor } : undefined,
      where: {
        id: {
          notIn: latestPosts.map(post => post.id), // Exclure les posts déjà récupérés
        },
      },
    });

    const posts = [...latestPosts, ...relevantPosts];

    const postsWithScores = posts.slice(0, pageSize).map((post) => ({
      ...post,
      relevanceScore: calculateRelevanceScore(
        post,
        user,
        posts[0]?.id || undefined,
      ),
    }));

    const sortedPosts = postsWithScores
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .map((post) => {
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
        return finalPost;
      });

    const nextCursor = posts.length > pageSize + latestPosts.length ? posts[pageSize + latestPosts.length].id : null;

    const data: PostsPage = {
      posts: sortedPosts,
      nextCursor,
    };

    return NextResponse.json({
      success: true,
      message: "Posts retrieved successfully",
      data,
    } as ApiResponse<PostsPage>);
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "Internal server error",
      name: "server-error",
      data: null,
    } as ApiResponse<null>);
  }
}
