"use client";

import { PostData } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PostEditor from "./editors/PostEditor";
import { useTranslation } from "@/context/LanguageContext";

export default function EditPostDialog({
  post,
  open,
  onClose,
}: {
  post: PostData;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("editPost")}</DialogTitle>
        </DialogHeader>
        <PostEditor key={post.id} post={post} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
