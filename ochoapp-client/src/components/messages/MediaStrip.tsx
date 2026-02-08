"use client";

import { MessageAttachment } from "@/lib/types";
import { useState } from "react";
import { Play } from "lucide-react";
import MediaCarousel from "./MediaCarousel";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface MediaStripProps {
  attachments?: MessageAttachment[];
  className?: string;
  isLoading?: boolean;
  onMediaOpen?: () => void;
  onMediaClose?: () => void;
}

export default function MediaStrip({
  attachments = [],
  className,
  isLoading = false,
  onMediaOpen,
  onMediaClose,
}: MediaStripProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  
  // Limiter à 4 médias affichés
  const MAX_VISIBLE_MEDIA = 4;
  const visibleAttachments = attachments.slice(0, MAX_VISIBLE_MEDIA);
  const remainingCount = attachments.length - MAX_VISIBLE_MEDIA;
  const hasMore = remainingCount > 0;

  if (isLoading) {
    return (
      <div className={cn("flex gap-2 flex-wrap mt-2 max-sm:max-w-64", className)}>
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="size-32 max-sm:size-24 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!attachments || attachments.length === 0) {
    return null;
  }

  const handleMediaClick = (index: number) => {
    setSelectedIndex(index);
    onMediaOpen?.();
  };

  return (
    <>
      <div
        className={cn(
          "flex gap-2 flex-wrap mt-2 max-sm:max-w-64",
          className
        )}
      >
        {visibleAttachments.map((attachment, index) => (
          <button
            key={index}
            onClick={() => handleMediaClick(index)}
            className="relative group rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
          >
            {attachment.type === "VIDEO" ? (
              <div className={`h-[${attachment.height}px] w-[${attachment.width}px}]`}>
                <video
                  src={attachment.url}
                  className={cn(
                    "rounded-lg object-cover cursor-pointer",
                    attachments.length === 1 ? "aspect-square object-cover max-w-xs max-h-96 max-sm:max-w-24 max-sm:max-h-24" : "size-32 max-sm:size-24",
                    `h-[${attachment.height}px] w-[${attachment.width}px}]`
                  )}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors rounded-lg">
                  <Play
                    size={32}
                    className="text-white/80 fill-white/80"
                  />
                </div>
              </div>
            ) : (
              <img
                src={attachment.url}
                alt={`Attachment ${index + 1}`}
                className={cn(
                  "rounded-lg object-cover cursor-pointer",
                  attachments.length === 1 ? "aspect-square object-cover max-w-xs max-h-96 max-sm:max-w-full" : "size-32 max-sm:size-24",
                  `h-[${attachment.height}px] w-[${attachment.width}px}]`
                )}
              />
            )}
          </button>
        ))}

        {/* Badge "+N" pour les médias restants */}
        {hasMore && (
          <button
            onClick={() => {
              setSelectedIndex(MAX_VISIBLE_MEDIA);
              onMediaOpen?.();
            }}
            className="relative group rounded-lg overflow-hidden hover:opacity-90 transition-opacity size-32 max-sm:size-24 bg-muted/50 border border-muted-foreground/30 flex items-center justify-center cursor-pointer"
          >
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">+{remainingCount}</div>
              <div className="text-xs text-muted-foreground">voir plus</div>
            </div>
          </button>
        )}
      </div>

      {selectedIndex !== null && (
        <MediaCarousel
          attachments={attachments}
          initialIndex={selectedIndex}
          onClose={() => {
            setSelectedIndex(null);
            onMediaClose?.();
          }}
        />
      )}
    </>
  );
}
