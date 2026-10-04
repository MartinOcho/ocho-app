"use client";

import { createContext, useContext } from "react";
import { PostData } from "@/lib/types";

export interface InstantPostModal {
  post: PostData;
  postPath: string;
  sourceUrl: string;
}

export interface PostModalContextValue {
  instantPost: InstantPostModal | null;
  openPost: (post: PostData, href: string) => void;
  closePost: () => void;
}

export const PostModalContext = createContext<PostModalContextValue | null>(
  null,
);

export function usePostModal() {
  const context = useContext(PostModalContext);
  if (!context) {
    throw new Error("usePostModal must be used within a PostModalProvider");
  }
  return context;
}
