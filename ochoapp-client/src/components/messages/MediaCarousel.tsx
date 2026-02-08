"use client";

import { MessageAttachment } from "@/lib/types";
import { useEffect, useState, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, Download, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveRoom } from "@/context/ChatContext";

interface MediaCarouselProps {
  attachments: MessageAttachment[];
  initialIndex?: number;
  onClose: () => void;
}

export default function MediaCarousel({
  attachments,
  initialIndex = 0,
  onClose,
}: MediaCarouselProps) {
  const { setIsMediaFullscreen } = useActiveRoom();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const filmstripRef = useRef<HTMLDivElement>(null);
  const currentThumbnailRef = useRef<HTMLButtonElement>(null);
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });

  // Wrapper pour fermer avec mise à jour du contexte
  const handleCloseCarousel = useCallback(() => {
    setIsMediaFullscreen(false);
    onClose();
  }, [onClose, setIsMediaFullscreen]);

  // Mettre le état fullscreen au montage et nettoyer au démontage
  useEffect(() => {
    setIsMediaFullscreen(true);
    return () => setIsMediaFullscreen(false);
  }, [setIsMediaFullscreen]);

  // Reset zoom quand on change de média
  useEffect(() => {
    setZoomLevel(1);
    setPanX(0);
    setPanY(0);
  }, [currentIndex]);

  // Scroll la pellicule pour afficher le média courant
  useEffect(() => {
    if (currentThumbnailRef.current && filmstripRef.current) {
      const thumbnail = currentThumbnailRef.current;
      const filmstrip = filmstripRef.current;
      
      const thumbnailLeft = thumbnail.offsetLeft;
      const thumbnailRight = thumbnailLeft + thumbnail.offsetWidth;
      const filmstripLeft = filmstrip.scrollLeft;
      const filmstripRight = filmstripLeft + filmstrip.clientWidth;

      if (thumbnailLeft < filmstripLeft) {
        filmstrip.scrollLeft = thumbnailLeft - 10;
      } else if (thumbnailRight > filmstripRight) {
        filmstrip.scrollLeft = thumbnailRight - filmstrip.clientWidth + 10;
      }
    }
  }, [currentIndex]);

  const current = Array.isArray(attachments) ? attachments[currentIndex] : null;
  const isFirstImage = currentIndex === 0;
  const isLastImage = Array.isArray(attachments) ? currentIndex === attachments.length - 1 : false;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCloseCarousel();
      } else if (e.key === "ArrowLeft") {
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        goToNext();
      } else if (e.key === "+") {
        handleZoomIn();
      } else if (e.key === "-") {
        handleZoomOut();
      } else if (e.key === "0") {
        setZoomLevel(1);
        setPanX(0);
        setPanY(0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex]);

  // Mouse wheel zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const new_zoom = e.deltaY > 0 ? zoomLevel - 0.1 : zoomLevel + 0.1;
        setZoomLevel(Math.max(1, Math.min(3, new_zoom)));
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
    }
    return () => {
      if (container) {
        container.removeEventListener("wheel", handleWheel);
      }
    };
  }, [zoomLevel]);

  // Pan when zoomed (mouse)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (zoomLevel > 1) {
        setIsDragging(true);
        setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && zoomLevel > 1) {
        const newPanX = e.clientX - dragStart.x;
        const newPanY = e.clientY - dragStart.y;
        setPanX(newPanX);
        setPanY(newPanY);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    container.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      container.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, panX, panY, zoomLevel, dragStart]);

  // Touch swipe and pan
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (zoomLevel > 1) {
        // Si zoomé: utiliser pour le pan
        e.preventDefault();
        const deltaX = e.touches[0].clientX - touchStartRef.current.x;
        const deltaY = e.touches[0].clientY - touchStartRef.current.y;
        setPanX(panX + deltaX);
        setPanY(panY + deltaY);
        touchStartRef.current.x = e.touches[0].clientX;
        touchStartRef.current.y = e.touches[0].clientY;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (zoomLevel <= 1) {
        // Si pas zoomé: utiliser pour naviguer ou fermer
        const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
        const timeDiff = Date.now() - touchStartRef.current.time;
        const isSwipe = Math.abs(deltaX) > 50 && timeDiff < 500;

        if (isSwipe) {
          if (deltaX > 0) {
            // Swipe vers la droite
            if (isFirstImage) {
              // À la première image: fermer le carrousel
              handleCloseCarousel();
            } else {
              // Sinon: aller à l'image précédente
              goToPrevious();
            }
          } else {
            // Swipe vers la gauche
            if (isLastImage) {
              // À la dernière image: fermer le carrousel
              handleCloseCarousel();
            } else {
              // Sinon: aller à l'image suivante
              goToNext();
            }
          }
        }
      }
    };

    container.addEventListener("touchstart", handleTouchStart);
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [zoomLevel, panX, panY, isFirstImage, isLastImage, handleCloseCarousel]);

  const goToNext = () => {
    if (!isLastImage) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const goToPrevious = () => {
    if (!isFirstImage) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(3, prev + 0.2));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(1, prev - 0.2));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanX(0);
    setPanY(0);
  };

  const handleDownload = () => {
    if (current?.url) {
      const link = document.createElement("a");
      link.href = current.url;
      link.download = `media-${currentIndex}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (!current) return null;

  const isVideo = current.type === "VIDEO";
  const isImage = current.type === "IMAGE";

  return (
    <div
      className="fixed inset-0 z-[9999999] max-sm:translate-x-full bg-black/95 backdrop-blur-sm flex flex-col transition-transform duration-200 max-sm:w-screen max-sm:h-screen max-sm:max-h-dvh max-sm:max-w-dvw"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCloseCarousel();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header avec contrôles */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2 text-white text-sm">
          <span className="font-medium">
            {currentIndex + 1} / {Array.isArray(attachments) ? attachments.length : 0}
          </span>
          {current?.type && (
            <span className="text-white/50 text-xs">
              {current.type === "VIDEO" ? "Vidéo" : "Image"}
            </span>
          )}
          {zoomLevel > 1 && (
            <span className="text-white/50 text-xs ml-2">
              Zoom: {(zoomLevel * 100).toFixed(0)}%
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isImage && (
            <>
              <button
                onClick={handleZoomIn}
                disabled={zoomLevel >= 3}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-30"
                title="Zoom avant (Ctrl + Souris)"
              >
                <ZoomIn size={20} className="text-white" />
              </button>
              <button
                onClick={handleZoomOut}
                disabled={zoomLevel <= 1}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-30"
                title="Zoom arrière"
              >
                <ZoomOut size={20} className="text-white" />
              </button>
              {zoomLevel > 1 && (
                <button
                  onClick={handleResetZoom}
                  className="px-2 py-1 text-xs rounded-lg hover:bg-white/10 transition-colors"
                  title="Réinitialiser le zoom"
                >
                  100%
                </button>
              )}
            </>
          )}
          <button
            onClick={handleDownload}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Télécharger"
          >
            <Download size={20} className="text-white" />
          </button>
          <button
            onClick={handleCloseCarousel}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Fermer"
          >
            <X size={20} className="text-white" />
          </button>
        </div>
      </div>

      {/* Media Container - prend tout l'espace disponible */}
      <div
        ref={containerRef}
        className={cn(
          "flex-1 flex items-center justify-center overflow-hidden relative w-full min-h-0",
          isDragging && "cursor-grabbing",
          zoomLevel > 1 && !isDragging && "cursor-grab"
        )}
      >
        <div
          className="flex items-center justify-center relative h-full w-full"
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${zoomLevel})`,
            transition: isDragging ? "none" : "transform 0.2s ease-out",
          }}
        >
          {isVideo ? (
            <video
              src={current.url}
              controls
              className="w-full h-full object-contain max-sm:w-screen max-sm:h-screen pointer-events-auto"
              autoPlay
              onContextMenu={(e) => e.preventDefault()}
            />
          ) : isImage ? (
            <img
              src={current.url}
              alt={`Media ${currentIndex + 1}`}
              className="w-full h-full object-contain max-sm:w-screen max-sm:h-screen cursor-auto"
              onContextMenu={(e) => e.preventDefault()}
            />
          ) : (
            <div className="text-white text-center">
              <p>Format non supporté</p>
            </div>
          )}
        </div>

        {/* Navigation Flèches */}
        {Array.isArray(attachments) && attachments.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              disabled={isFirstImage}
              className={cn(
                "absolute left-4 p-3 rounded-full transition-all z-10",
                isFirstImage
                  ? "opacity-30 cursor-not-allowed bg-white/5"
                  : "opacity-70 hover:opacity-100 hover:bg-white/20 cursor-pointer"
              )}
              title="Image précédente (←)"
            >
              <ChevronLeft size={24} className="text-white" />
            </button>

            <button
              onClick={goToNext}
              disabled={isLastImage}
              className={cn(
                "absolute right-4 p-3 rounded-full transition-all z-10",
                isLastImage
                  ? "opacity-30 cursor-not-allowed bg-white/5"
                  : "opacity-70 hover:opacity-100 hover:bg-white/20 cursor-pointer"
              )}
              title="Image suivante (→)"
            >
              <ChevronRight size={24} className="text-white" />
            </button>
          </>
        )}
      </div>

      {/* Footer avec filmstrip/thumbnails scrollable - taille réduite */}
      {Array.isArray(attachments) && attachments.length > 1 && (
        <div className="border-t border-white/10 bg-black/50 p-2 flex-shrink-0">
          <div 
            ref={filmstripRef}
            className="flex gap-1.5 overflow-x-auto pb-2 scroll-smooth"
            style={{ scrollBehavior: "smooth" }}
          >
            {attachments.map((attachment, index) => (
              <button
                key={index}
                ref={currentIndex === index ? currentThumbnailRef : null}
                onClick={() => {
                  setCurrentIndex(index);
                }}
                className={cn(
                  "relative flex-shrink-0 rounded-lg overflow-hidden transition-all",
                  currentIndex === index
                    ? "ring-2 ring-white/50 scale-105"
                    : "opacity-60 hover:opacity-100"
                )}
              >
                {attachment.type === "VIDEO" ? (
                  <>
                    <video
                      src={attachment.url}
                      className="w-14 h-14 object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-6 border-t-white/70 opacity-60"></div>
                    </div>
                  </>
                ) : (
                  <img
                    src={attachment.url}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-14 h-14 object-cover"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
