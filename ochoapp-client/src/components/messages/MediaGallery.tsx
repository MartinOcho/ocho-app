"use client";

import { GalleryMedia, SocketGalleryUpdatedEvent } from "@/lib/types";
import { useState, useMemo, useEffect } from "react";
import MediaCarousel from "./MediaCarousel";
import { cn } from "@/lib/utils";
import { Play, ChevronDown, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSocket } from "@/components/providers/SocketProvider";
import { useInView } from "react-intersection-observer";

interface MediaGalleryProps {
  roomId: string;
  className?: string;
  medias?: GalleryMedia[];
  isLoading?: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
}

export default function MediaGallery({
  roomId,
  medias = [],
  className,
  isLoading = false,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
}: MediaGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [displayedMedias, setDisplayedMedias] = useState<GalleryMedia[]>(medias);
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.1,
  });
  const { socket } = useSocket();

  // Mettre à jour les médias affichés quand `medias` change
  useEffect(() => {
    setDisplayedMedias(medias);
  }, [medias]);

  // Gérer le chargement des pages suivantes via IntersectionObserver
  useEffect(() => {
    if (inView && hasNextPage && onLoadMore && !isFetchingNextPage) {
      onLoadMore();
    }
  }, [inView, hasNextPage, onLoadMore, isFetchingNextPage]);

  // Écouter les mises à jour de la galerie via socket
  useEffect(() => {
    if (!socket) return;

    const handleGalleryUpdated = (event: SocketGalleryUpdatedEvent) => {
      if (event.roomId === roomId && event.medias && event.medias.length > 0) {
        // Ajouter les nouveaux médias au début de la liste
        setDisplayedMedias((prev) => [...event.medias, ...prev]);
      }
    };

    socket.on("gallery_updated", handleGalleryUpdated);

    return () => {
      socket.off("gallery_updated", handleGalleryUpdated);
    };
  }, [socket, roomId]);

  if (isLoading && displayedMedias.length === 0) {
    return (
      <div className={cn("p-3 border-t border-border", className)}>
        <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
          Galerie
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="w-full h-24 rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (!displayedMedias?.length) {
    return (
      <div className={cn("p-3 border-t border-border", className)}>
        <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
          Galerie
        </h4>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Images
            size={32}
            className="text-muted-foreground/50 mb-2"
          />
          <p className="text-sm text-muted-foreground">
            Aucun média partagé
          </p>
        </div>
      </div>
    );
  }

  // Show grid of thumbnails (maximum 12 items initially)
  const visibleMedias = displayedMedias.slice(0, 12);

  return (
    <>
      <div className={cn("p-3 border-t border-border", className)}>
        <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
          Galerie
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {visibleMedias.map((media, index) => (
            <button
              key={`${media.messageId}-${media.id}`}
              onClick={() => setSelectedIndex(index)}
              className="relative group rounded-md overflow-hidden aspect-square hover:opacity-80 transition-opacity"
              title={`Envoyé par ${media.senderUsername}`}
            >
              {media.type === "VIDEO" ? (
                <>
                  <video
                    src={media.url}
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
                  src={media.url}
                  alt={`Media de ${media.senderUsername}`}
                  className="w-full h-full object-cover"
                />
              )}
            </button>
          ))}
        </div>

        {displayedMedias.length > visibleMedias.length && (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-muted-foreground">
              +{displayedMedias.length - visibleMedias.length} médias
            </p>
            {hasNextPage && (
              <button
                ref={loadMoreRef}
                onClick={onLoadMore}
                disabled={isFetchingNextPage}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors disabled:opacity-50"
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Chargement...
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} />
                    Charger plus
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {selectedIndex !== null && (
        <MediaCarousel
          attachments={visibleMedias}
          initialIndex={selectedIndex}
          onClose={() => setSelectedIndex(null)}
        />
      )}
    </>
  );
}
