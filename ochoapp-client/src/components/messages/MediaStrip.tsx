"use client";

import { MessageAttachment } from "@/lib/types";
import { useState } from "react";
import { Play } from "lucide-react";
import MediaCarousel from "./MediaCarousel";
import { cn } from "@/lib/utils";

interface MediaStripProps {
  attachments: MessageAttachment[];
  className?: string;
}

export default function MediaStrip({
  attachments,
  className,
}: MediaStripProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          "flex gap-2 flex-wrap mt-2 max-sm:max-w-40",
          className
        )}
      >
        {attachments.map((attachment, index) => (
          <button
            key={index}
            onClick={() => setSelectedIndex(index)}
            className="relative group rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
          >
            {attachment.type === "VIDEO" ? (
              <>
                <video
                  src={attachment.url}
                  className={cn(
                    "rounded-lg object-cover cursor-pointer",
                    attachments.length === 1 ? "max-w-xs max-h-96 max-sm:max-w-24 max-sm:max-h-24" : "size-32 max-sm:size-24"
                  )}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors rounded-lg">
                  <Play
                    size={32}
                    className="text-white/80 fill-white/80"
                  />
                </div>
              </>
            ) : (
              <img
                src={attachment.url}
                alt={`Attachment ${index + 1}`}
                className={cn(
                  "rounded-lg object-cover cursor-pointer",
                  attachments.length === 1 ? "max-w-xs max-h-96 max-sm:max-w-24 max-sm:max-h-24" : "size-32 max-sm:size-24"
                )}
              />
            )}
          </button>
        ))}
      </div>

      {selectedIndex !== null && (
        <MediaCarousel
          attachments={attachments}
          initialIndex={selectedIndex}
          onClose={() => setSelectedIndex(null)}
        />
      )}
    </>
  );
}
