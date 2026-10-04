import { validateRequest } from "@/auth";
import InterceptedPostModal from "@/components/posts/InterceptedPostModal";
import { getPost } from "@/lib/getPost";

interface InterceptedPostPageProps {
  params: Promise<{ postId: string }>;
  searchParams: Promise<{ comment?: string }>;
}

export default async function InterceptedPostPage({
  params,
  searchParams,
}: InterceptedPostPageProps) {
  const [{ postId }, { comment }, { user }] = await Promise.all([
    params,
    searchParams,
    validateRequest(),
  ]);
  const post = await getPost(postId, user?.id || "", comment);

  return <InterceptedPostModal post={post} />;
}
