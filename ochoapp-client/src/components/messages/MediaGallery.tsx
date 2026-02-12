"use client";

import { GalleryMedia, SocketGalleryUpdatedEvent, GalleryMediasSection } from "@/lib/types";
import { useState, useMemo, useEffect } from "react";
import MediaCarousel from "./MediaCarousel";
import { cn } from "@/lib/utils";
import { Play, ChevronDown, Loader2, Images } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSocket } from "@/components/providers/SocketProvider";
import { useInView } from "react-intersection-observer";
import { QueryClient, InfiniteData } from "@tanstack/react-query";
import {
  isValidGalleryMedia,
  validateGalleryMedias,
} from "@/lib/validation-types";
import { useTranslation } from "@/context/LanguageContext";

interface MediaGalleryProps {
  roomId: string;
  className?: string;
  medias?: GalleryMedia[];
  isLoading?: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  queryClient?: QueryClient;
}

export default function MediaGallery({
  roomId,
  medias = [],
  className,
  isLoading = false,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  queryClient,
}: MediaGalleryProps) {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [displayedMedias, setDisplayedMedias] = useState<GalleryMedia[]>(medias);
  const [showMore, setShowMore] = useState(false);
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.1,
  });
  const { socket } = useSocket();

  // Mettre à jour les médias affichés quand `medias` change
  useEffect(() => {
    const validatedMedias = validateGalleryMedias(medias ?? []);
    setDisplayedMedias(validatedMedias);
  }, [medias]);

  // Gérer le chargement des pages suivantes via IntersectionObserver
  useEffect(() => {
    if (inView && hasNextPage && onLoadMore && !isFetchingNextPage) {
      onLoadMore();
    }
  }, [inView, hasNextPage, onLoadMore, isFetchingNextPage]);

  // Écouter les mises à jour et suppressions de la galerie via socket
  useEffect(() => {
    if (!socket) return;

    const handleGalleryUpdated = (event: SocketGalleryUpdatedEvent) => {
      // Guard 1: Vérifier les données entrantes
      if (event.roomId !== roomId) {
        return;
      }

      // Guard 2: Valider et filtrer les médias reçus
      const validMedias = validateGalleryMedias(event.medias ?? []);

      if (validMedias.length === 0) {
        if (event.medias && event.medias.length > 0) {
          console.warn("Médias invalides reçus du socket:", event.medias);
        }
        return;
      }

      // Mettre à jour l'état local avec les nouveaux médias
      setDisplayedMedias((prev) => {
        // Éviter les doublons (vérifier par ID)
        const existingIds = new Set(prev.map((m) => m.id));
        const newMedias = validMedias.filter((m) => !existingIds.has(m.id));
        return newMedias.length > 0 ? [...newMedias, ...prev] : prev;
      });

      // Mettre à jour le cache React Query directement avec typage strict
      if (queryClient) {
        queryClient.setQueryData<InfiniteData<GalleryMediasSection>>(
          ["gallery", "medias", roomId],
          (oldData) => {
            // Guard 3: Vérifier la structure des données du cache
            if (
              !oldData ||
              !Array.isArray(oldData.pages) ||
              oldData.pages.length === 0
            ) {
              return oldData;
            }

            // Mettre à jour la première page uniquement
            const newPages = oldData.pages.map((page, index) => {
              if (index !== 0 || !page) return page;

              // Guard 4: Vérifier que la page a les médias et les valider
              const pageMedias = validateGalleryMedias(page.medias ?? []);

              // Éviter les doublons
              const existingIds = new Set(pageMedias.map((m) => m.id));
              const newMedias = validMedias.filter(
                (m) => !existingIds.has(m.id)
              );

              if (newMedias.length === 0) return page;

              return {
                ...page,
                medias: [...newMedias, ...pageMedias],
              };
            });

            return {
              ...oldData,
              pages: newPages,
            };
          }
        );
      }
    };

    const handleGalleryDeleted = (event: {
      roomId: string;
      attachmentIds: string[];
    }) => {
      // Guard 1: Vérifier que c'est le bon salon
      if (event.roomId !== roomId) {
        return;
      }

      const attachmentIdsToDelete = new Set(event.attachmentIds);

      // Mettre à jour l'état local en supprimant les médias
      setDisplayedMedias((prev) =>
        prev.filter((m) => !attachmentIdsToDelete.has(m.id))
      );

      // Mettre à jour le cache React Query
      if (queryClient) {
        queryClient.setQueryData<InfiniteData<GalleryMediasSection>>(
          ["gallery", "medias", roomId],
          (oldData) => {
            // Guard 2: Vérifier la structure des données du cache
            if (
              !oldData ||
              !Array.isArray(oldData.pages) ||
              oldData.pages.length === 0
            ) {
              return oldData;
            }

            // Mettre à jour toutes les pages pour supprimer les médias
            const newPages = oldData.pages.map((page) => {
              if (!page) return page;

              return {
                ...page,
                medias: (page.medias ?? []).filter(
                  (m) => !attachmentIdsToDelete.has(m.id)
                ),
              };
            });

            return {
              ...oldData,
              pages: newPages,
            };
          }
        );
      }
    };

    socket.on("gallery_updated", handleGalleryUpdated);
    socket.on("gallery_deleted", handleGalleryDeleted);

    return () => {
      socket.off("gallery_updated", handleGalleryUpdated);
      socket.off("gallery_deleted", handleGalleryDeleted);
    };
  }, [socket, roomId, queryClient]);

  if (isLoading && displayedMedias.length === 0) {
    return (
      <div className={cn("p-3 border-t border-border", className)}>
        <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
          {t("gallery")}
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
          {t("gallery")}
        </h4>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Images
            size={32}
            className="text-muted-foreground/50 mb-2"
          />
          <p className="text-sm text-muted-foreground">
            {t("noMediaShared")}
          </p>
        </div>
      </div>
    );
  }

  // Show grid of thumbnails (maximum 12 items initially)
  // If showMore is true, show all medias from the current state
  // Guard: Valider les médias avant affichage
  const safeDisplayedMedias = validateGalleryMedias(displayedMedias);
  const visibleMedias = showMore ? safeDisplayedMedias : safeDisplayedMedias.slice(0, 12);

  return (
    <>
      <div className={cn("p-3 border-t border-border", className)}>
        <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
          {t("gallery")}
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {visibleMedias.map((media) => {
            // Guard final: Vérifier chaque média avant rendu
            if (!isValidGalleryMedia(media)) {
              console.warn("Média invalide à l'affichage:", media);
              return null;
            }

            return (
              <button
                key={`${media.messageId}-${media.id}`}
                onClick={() => setSelectedIndex(visibleMedias.indexOf(media))}
                className="relative group rounded-md overflow-hidden aspect-square hover:opacity-80 transition-opacity"
                title={`Envoyé par ${media.senderUsername || "inconnu"}`}
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
            );
          })}
        </div>

        {displayedMedias.length > visibleMedias.length && (
          <div className="mt-4 space-y-3 border-t border-border pt-3">
            {displayedMedias.length > visibleMedias.length && !hasNextPage && !showMore && (
              <p className="text-xs text-muted-foreground text-center">
                {t("mediaDisplayCount").replace("[current]", String(visibleMedias.length)).replace("[total]", String(displayedMedias.length))}
              </p>
            )}
            {hasNextPage ? (
              <button
                ref={loadMoreRef}
                onClick={onLoadMore}
                disabled={isFetchingNextPage}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {t("loadingOldMedias")}
                  </>
                ) : (
                  <>
                    <ChevronDown size={16} />
                    {t("showOlderMedias")}
                  </>
                )}
              </button>
            ) : (
              !showMore && (
                <button
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-md transition-colors border border-primary/30"
                  onClick={() => setShowMore(true)}
                >
                  <>
                    <ChevronDown size={16} />
                    Afficher ({safeDisplayedMedias.length - visibleMedias.length} médias supplémentaires)
                  </>
                </button>
              )
            )}
            {showMore && safeDisplayedMedias.length > visibleMedias.length && (
              <button
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                onClick={() => setShowMore(false)}
              >
                <>
                  <ChevronDown size={16} className="rotate-180" />
                  Masquer
                </>
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
