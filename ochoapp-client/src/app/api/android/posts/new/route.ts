import prisma from "@/lib/prisma";
import { getPostDataIncludes } from "@/lib/types";
import { createPostSchema } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";
import { ApiResponse } from "../../utils/dTypes";
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

    const { content, mediaIds, gradient } = createPostSchema.parse(input);

    const newPost = await prisma.post.create({
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

    return NextResponse.json({
      success: true,
      message: "Post publié avec succès.",
      data: {
        ...newPost,
        createdAt: newPost.createdAt.getTime(),
        attachments: newPost.attachments.map((attachment) => ({
          ...attachment,
          createdAt: attachment.createdAt.getTime(),
        })),
        likes: 0,
        comments: 0,
        user: {
          ...newPost.user,
          createdAt: newPost.user.createdAt.getTime(),
          lastSeen: newPost.user.lastSeen.getTime(),
          verified: newPost.user.verified.map((item) => ({
            ...item,
            expiresAt: item.expiresAt?.getTime(),
          })),
        },
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      success: false,
      message: "Quelque chose s'est mal passé. Veuillez réessayer.",
    } as ApiResponse<null>);
  }
}
