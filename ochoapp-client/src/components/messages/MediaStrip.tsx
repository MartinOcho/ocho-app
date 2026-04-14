"use client";

import { MessageAttachment } from "@/lib/types";
import { useState } from "react";
import { Play, FileText } from "lucide-react";
import { useTranslation } from "@/context/LanguageContext";
import MediaCarousel from "./MediaCarousel";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

function getAttachmentName(attachment: MessageAttachment) {
  return attachment.fileName || attachment.url.split("/").pop() || "Fichier";
}

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
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  
  const mediaAttachments = attachments.filter((attachment) => attachment.type !== "DOCUMENT");
  const hiddenAttachments = attachments.slice(3);

  // Afficher 3 items complètes + la 4ème avec overlay badge
  const MAX_VISIBLE_MEDIA = 3;
  const hasMore = attachments.length > MAX_VISIBLE_MEDIA;
  const remainingCount = attachments.length - MAX_VISIBLE_MEDIA;

  const openMediaCarousel = (attachment: MessageAttachment) => {
    const mediaIndex = mediaAttachments.findIndex((item) => item.id === attachment.id);
    if (mediaIndex >= 0) {
      setSelectedIndex(mediaIndex);
      onMediaOpen?.();
    }
  };

  const openDocument = (attachment: MessageAttachment) => {
    const link = document.createElement("a");
    link.href = attachment.url;
    const baseName = attachment.fileName || attachment.url.split("/").pop() || "document";
    const downloadName = attachment.format && !baseName.includes('.') ? `${baseName}.${attachment.format}` : baseName;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleHiddenClick = () => {
    const hiddenMedia = hiddenAttachments.find((attachment) => attachment.type !== "DOCUMENT");
    if (hiddenMedia) {
      openMediaCarousel(hiddenMedia);
      return;
    }

    const hiddenDocument = hiddenAttachments.find((attachment) => attachment.type === "DOCUMENT");
    if (hiddenDocument) {
      openDocument(hiddenDocument);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex gap-2 flex-wrap mt-2 max-w-full max-sm:max-w-64", className)}>
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="size-32 max-sm:size-24 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          "grid gap-2 grid-cols-2 w-fit max-w-full max-sm:max-w-64",
          className
        )}
      >
        {attachments.slice(0, MAX_VISIBLE_MEDIA).map((attachment, index) => {
          const content = attachment.type === "VIDEO" ? (
            <div className="relative overflow-hidden rounded-lg bg-accent">
              <video
                width={attachment.width || undefined}
                height={attachment.height || undefined}
                src={attachment.url}
                className={cn(
                  "rounded-lg object-cover cursor-pointer bg-accent",
                  attachments.length === 1 ? "aspect-square object-cover max-w-xs max-h-96 max-sm:max-w-24 max-sm:max-h-24" : "size-32 max-sm:size-24"
                )}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors rounded-lg">
                <Play size={32} className="text-white/80 fill-white/80" />
              </div>
            </div>
          ) : attachment.type === "IMAGE" ? (
            <img
              width={attachment.width || undefined}
              height={attachment.height || undefined}
              src={attachment.url}
              alt={`Attachment ${index + 1}`}
              className={cn(
                "rounded-lg object-cover cursor-pointer bg-accent",
                attachments.length === 1 ? "aspect-square object-cover max-w-xs max-h-96 max-sm:max-w-full" : "size-32 max-sm:size-24"
              )}
            />
          ) : (
            <div className="flex min-h-[120px] min-w-[120px] flex-col items-center justify-center gap-2 rounded-lg border border-border/20 bg-background p-4 text-center shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/20 text-muted-foreground">
                <FileText size={24} />
              </div>
              <div className="space-y-1">
                <p className="max-w-[10rem] truncate text-sm font-semibold text-foreground">
                  {getAttachmentName(attachment)}
                </p>
                {attachment.format && (
                  <p className="text-xs uppercase text-muted-foreground/80">
                    {attachment.format}
                  </p>
                )}
              </div>
            </div>
          );

          return attachment.type === "DOCUMENT" ? (
            <button
              key={index}
              onClick={() => openDocument(attachment)}
              className="relative group rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
            >
              {content}
            </button>
          ) : (
            <button
              key={index}
              onClick={() => openMediaCarousel(attachment)}
              className="relative group rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
            >
              {content}
            </button>
          );
        })}

        {/* 4ème image avec badge "+N" overlay */}
        {hasMore && attachments[MAX_VISIBLE_MEDIA] && (
          <button
            onClick={handleHiddenClick}
            className="relative group rounded-lg overflow-hidden hover:opacity-70 transition-opacity"
          >
            {attachments[MAX_VISIBLE_MEDIA].type === "VIDEO" ? (
              <div className="relative overflow-hidden rounded-lg bg-accent">
                <video
                  src={attachments[MAX_VISIBLE_MEDIA].url}
                  className={cn(
                    "rounded-lg object-cover cursor-pointer bg-accent",
                    "size-32 max-sm:size-24"
                  )}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors rounded-lg">
                  <Play size={32} className="text-white/80 fill-white/80" />
                </div>
              </div>
            ) : attachments[MAX_VISIBLE_MEDIA].type === "IMAGE" ? (
              <img
                src={attachments[MAX_VISIBLE_MEDIA].url}
                alt={`Attachment 4`}
                className={cn(
                  "rounded-lg object-cover cursor-pointer bg-accent",
                  "size-32 max-sm:size-24"
                )}
              />
            ) : (
              <div className="flex min-h-[120px] min-w-[120px] flex-col items-center justify-center gap-2 rounded-lg border border-border/20 bg-background p-4 text-center shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/20 text-muted-foreground">
                  <FileText size={24} />
                </div>
                <div className="space-y-1">
                  <p className="max-w-[10rem] truncate text-sm font-semibold text-foreground">
                    {getAttachmentName(attachments[MAX_VISIBLE_MEDIA])}
                  </p>
                  {attachments[MAX_VISIBLE_MEDIA].format && (
                    <p className="text-xs uppercase text-muted-foreground/80">
                      {attachments[MAX_VISIBLE_MEDIA].format}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Badge overlay "+N" */}
            {remainingCount > 1 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 group-hover:bg-black/60 transition-colors rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">+{remainingCount}</div>
                  <div className="text-xs text-white/80">{t("seeMore")}</div>
                </div>
              </div>
            )}
          </button>
        )}
      </div>

      {selectedIndex !== null && (
        <MediaCarousel
          attachments={mediaAttachments}
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
