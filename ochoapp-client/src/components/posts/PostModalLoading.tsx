"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { usePostModal } from "@/context/PostModalContext";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export default function PostModalLoading() {
  const router = useRouter();
  const { instantPost } = usePostModal();

  useEffect(() => {
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      router.replace(window.location.href);
    }
  }, [router]);

  if (instantPost) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && router.back()}>
      <DialogContent className="bg-card z-[60] max-h-[90dvh] gap-0 overflow-hidden rounded-xl border-0 p-0 shadow-2xl max-sm:fixed max-sm:inset-0 max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none sm:max-w-xl">
        <DialogTitle className="sr-only">
          Chargement de la publication
        </DialogTitle>
        <div className="animate-pulse space-y-5 p-5">
          <div className="bg-muted h-8 w-2/3 rounded" />
          <div className="bg-muted h-5 w-1/2 rounded" />
          <div className="bg-muted aspect-video w-full rounded" />
          <div className="bg-muted h-10 w-full rounded" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
