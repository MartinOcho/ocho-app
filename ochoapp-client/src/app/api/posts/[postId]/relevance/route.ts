import { validateRequest } from "@/auth";
import { calculateRelevanceScore } from "@/lib/postScore";
import prisma from "@/lib/prisma";
import { getPostDataIncludes } from "@/lib/types";

export async function POST(
  req: Request,
  { params}: { params: Promise<{ postId: string }> },
) {
  const { user } = await validateRequest();
  const { postId } = await params;
  if (!user) {
    return Response.json({ error: "Action non autorisée" }, { status: 401 });
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
  return Response.json({ success: true });
}
