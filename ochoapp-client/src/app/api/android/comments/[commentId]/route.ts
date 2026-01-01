import { NextRequest, NextResponse } from "next/server";
import { ApiResponse } from "../../utils/dTypes";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "../../auth/utils";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const { commentId } = await params;
  try {
    const { user, message } = await getCurrentUser();
    if (!user) {
      return NextResponse.json({
        success: false,
        message: message || "Utilisateur non authentifié.",
        name: "unauthorized",
      } as ApiResponse<null>);
    }

    const userId = user.id;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true },
    });
    if (!comment) {
      return NextResponse.json({
        success: false,
        message: "Comment not found.",
        name: "not_found",
      } as ApiResponse<null>);
    }
    if (comment.userId !== userId) {
      return NextResponse.json({
        success: false,
        message: "Forbidden: You can only delete your own comments.",
        name: "forbidden",
      } as ApiResponse<null>);
    }
    await prisma.comment.delete({
      where: { id: commentId },
    });
    return NextResponse.json({
      success: true,
      message: "Comment deleted successfully.",
    } as ApiResponse<null>);
  } catch (error) {
    
  }
  return NextResponse.json({
    success: true,
    message: "Replies endpoint is operational.",
  } as ApiResponse<null>);
}