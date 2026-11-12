"use client";

import UserAvatar from "@/components/UserAvatar";
import { useSession } from "@/app/(main)/SessionProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { X } from "lucide-react";
import PostEditor from "./editors/PostEditor";
import { useState } from "react";
import { useTranslation } from "@/context/LanguageContext";

export default function CreatePostDialog() {
  const { user } = useSession();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        className="bg-card hover:bg-card/80 h-auto w-full justify-start gap-3 rounded-xl p-3 text-left shadow-sm"
      >
        <UserAvatar userId={user.id} avatarUrl={user.avatarUrl} size={42} />
        <span className="text-muted-foreground min-w-0 flex-1 truncate font-normal">
          {t("wtsup").replace("[name]", user.displayName.split(" ")[0])}
        </span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
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
              {t("newPost")}
            </DialogTitle>
            <span className="w-10" aria-hidden="true" />
          </div>
          {open && (
            <PostEditor
              key="create-post"
              variant="dialog"
              onClose={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
