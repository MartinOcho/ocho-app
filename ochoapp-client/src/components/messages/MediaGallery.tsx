"use client";

import { RoomData, MessageData, MessageAttachment } from "@/lib/types";
import { useState, useMemo } from "react";
import MediaCarousel from "./MediaCarousel";
import { cn } from "@/lib/utils";
import { Play } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface MediaGalleryProps {
  messages?: MessageData[];
  className?: string;
  isLoading?: boolean;
}

export default function MediaGallery({
  messages = [],
  className,
  isLoading = false,
}: MediaGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Extract all attachments from messages in reverse order (newest first)
  const allAttachments = useMemo(() => {
    if (!Array.isArray(messages) || messages.length === 0) return [];

    const attachments: (MessageAttachment & { messageId: string })[] = [];

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!msg) continue;
      const atts = Array.isArray(msg.attachments) ? msg.attachments : [];
      if (atts.length > 0) {
        atts.forEach((att) => {
          if (att) {
            attachments.push({
              ...att,
              messageId: msg.id,
            });
          }
        });
      }
    }

    return attachments;
  }, [messages]);

  if (isLoading) {
    return (
      <div className={cn("p-3 border-t border-border", className)}>
        <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
          Médias
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (!allAttachments?.length) {
    return null;
  }

  // Show grid of thumbnails (maximum 6 items)
  const displayedAttachments = allAttachments?.slice(0, 12) || [];

  return (
    <>
      <div className={cn("p-3 border-t border-border", className)}>
        <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
          Médias
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {displayedAttachments.map((attachment, index) => (
            <button
              key={`${attachment.messageId}-${index}`}
              onClick={() => setSelectedIndex(index)}
              className="relative group rounded-md overflow-hidden aspect-square hover:opacity-80 transition-opacity"
            >
              {attachment.type === "VIDEO" ? (
                <>
                  <video
                    src={attachment.url}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
                    <Play
                      size={16}
                      className="text-white/80 fill-white/80"
                    />
                  </div>
                </>
              ) : (
                <img
                  src={attachment.url}
                  alt={`Media ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              )}
            </button>
          ))}
        </div>

        {allAttachments.length > displayedAttachments.length && (
          <p className="text-xs text-muted-foreground mt-2">
            +{allAttachments.length - displayedAttachments.length} médias
          </p>
        )}
      </div>

      {selectedIndex !== null && (
        <MediaCarousel
          attachments={displayedAttachments as MessageAttachment[]}
          initialIndex={selectedIndex}
          onClose={() => setSelectedIndex(null)}
        />
      )}
    </>
  );
}
