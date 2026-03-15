import prisma from "@/lib/prisma";
import { getPostDataIncludes } from "@/lib/types";
import { createPostSchema } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";
import { ApiResponse, Post, User, VerifiedUser } from "../../utils/dTypes";
import { getCurrentUser } from "../../auth/utils";

export async function POST(req: NextRequest) {
  try {
    const {user, message} = await getCurrentUser();

    if (!user) {
      return NextResponse.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      } as ApiResponse<null>);
    }
    const input = await req.json();

    const currentUserId = user.id


    const { content, mediaIds, gradient } = createPostSchema.parse(input);

    const post = await prisma.post.create({
      data: {
        content,
        userId: user.id,
        gradient,
        attachments: {
          connect: mediaIds.map((id: string) => ({ id })),
        },
      },
      include: getPostDataIncludes(user.id),
    });

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
    
          const newPost: Post = {
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

    return NextResponse.json<ApiResponse<Post>>({
      success: true,
      message: "Post publié avec succès.",
      data: newPost,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      message: "Quelque chose s'est mal passé. Veuillez réessayer.",
    });
  }
}
