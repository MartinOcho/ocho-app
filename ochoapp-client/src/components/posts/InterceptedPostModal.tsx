"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { usePostModal } from "@/context/PostModalContext";
import { PostData } from "@/lib/types";
import PostModal from "./PostModal";

export default function InterceptedPostModal({ post }: { post: PostData }) {
  const router = useRouter();
  const { instantPost } = usePostModal();

  useEffect(() => {
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      router.replace(window.location.href);
    }
  }, [router]);

  if (instantPost?.post.id === post.id) {
    return null;
  }

  return <PostModal post={post} onClose={() => router.back()} />;
}
