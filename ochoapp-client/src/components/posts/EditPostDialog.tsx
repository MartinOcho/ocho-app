"use client";

import { PostData } from "@/lib/types";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import PostEditor from "./editors/PostEditor";
import { useTranslation } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

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
      <DialogContent className="bg-background fixed inset-0 top-0 left-0 z-70 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(90dvh,760px)] sm:max-h-[90dvh] sm:w-[min(92vw,680px)] sm:max-w-[680px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border [&>button:last-child]:hidden">
        <div className="flex h-16 shrink-0 items-center justify-between border-b px-4">
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("close")}
            >
              <X aria-hidden="true" />
            </Button>
          </DialogClose>
          <DialogTitle className="text-lg font-semibold">
            {t("editPost")}
          </DialogTitle>
          <span className="w-10" aria-hidden="true" />
        </div>
        {open && (
          <PostEditor
            key={post.id}
            post={post}
            variant="dialog"
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
