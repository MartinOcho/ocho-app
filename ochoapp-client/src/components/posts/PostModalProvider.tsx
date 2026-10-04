"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PostData } from "@/lib/types";
import PostModal from "./PostModal";
import { InstantPostModal, PostModalContext } from "@/context/PostModalContext";

export default function PostModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [instantPost, setInstantPost] = useState<InstantPostModal | null>(null);
  const modalPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!instantPost) {
      modalPathRef.current = null;
      return;
    }

    const sourcePath = new URL(instantPost.sourceUrl, window.location.origin)
      .pathname;

    if (pathname === instantPost.postPath) {
      modalPathRef.current = instantPost.postPath;
    } else if (pathname !== sourcePath || modalPathRef.current) {
      setInstantPost(null);
    }
  }, [instantPost, pathname]);

  const openPost = (post: PostData, href: string) => {
    const postPath = href.split("?")[0];
    setInstantPost({
      post,
      postPath,
      sourceUrl: `${window.location.pathname}${window.location.search}`,
    });
    router.push(href);
  };

  const closePost = () => {
    if (!instantPost) return;
    setInstantPost(null);
    router.replace(instantPost.sourceUrl);
  };

  return (
    <PostModalContext.Provider value={{ instantPost, openPost, closePost }}>
      {children}
      {instantPost && <PostModal post={instantPost.post} onClose={closePost} />}
    </PostModalContext.Provider>
  );
}
