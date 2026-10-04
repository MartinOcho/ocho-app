"use client";

import Post from "./Post";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PostData } from "@/lib/types";

interface PostModalProps {
  post: PostData;
  onClose: () => void;
}

export default function PostModal({ post, onClose }: PostModalProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card z-[60] max-h-[90dvh] gap-0 overflow-y-auto rounded-xl border-0 p-0 shadow-2xl max-sm:fixed max-sm:inset-0 max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none sm:max-w-xl">
        <DialogTitle className="border-b p-4 text-center text-base font-semibold leading-none max-sm:hidden">
          Publication de {post.user.displayName}
        </DialogTitle>
        <Post post={post} />
      </DialogContent>
    </Dialog>
  );
}
