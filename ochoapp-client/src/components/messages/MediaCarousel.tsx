"use client";

import { MessageAttachment } from "@/lib/types";
import { useEffect, useState, useRef } from "react";
import { ChevronLeft, ChevronRight, X, Download } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = attachments[currentIndex];
  const isFirstImage = currentIndex === 0;
  const isLastImage = currentIndex === attachments.length - 1;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        goToNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, onClose]);

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

  const goToNext = () => {
    if (!isLastImage) {
      setCurrentIndex((prev) => prev + 1);
      setZoomLevel(1);
      setIsZoomed(false);
    }
  };

  const goToPrevious = () => {
    if (!isFirstImage) {
      setCurrentIndex((prev) => prev - 1);
      setZoomLevel(1);
      setIsZoomed(false);
    }
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
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Header avec contrôles */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2 text-white text-sm">
          <span className="font-medium">
            {currentIndex + 1} / {attachments.length}
          </span>
          {current.type && (
            <span className="text-white/50 text-xs">
              {current.type === "VIDEO" ? "Vidéo" : "Image"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Télécharger"
          >
            <Download size={20} className="text-white" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Fermer"
          >
            <X size={20} className="text-white" />
          </button>
        </div>
      </div>

      {/* Media Container */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-auto relative"
      >
        <div
          className="flex items-center justify-center relative h-full w-full"
          style={{
            transform: isZoomed ? `scale(${zoomLevel})` : "scale(1)",
            transition: "transform 0.2s ease-out",
          }}
        >
          {isVideo ? (
            <video
              src={current.url}
              controls
              className="max-h-full max-w-full object-contain"
              autoPlay
            />
          ) : isImage ? (
            <img
              src={current.url}
              alt={`Media ${currentIndex + 1}`}
              className="max-h-full max-w-full object-contain"
              onClick={() => setIsZoomed(!isZoomed)}
            />
          ) : (
            <div className="text-white text-center">
              <p>Format non supporté</p>
            </div>
          )}
        </div>

        {/* Navigation Flèches */}
        {attachments.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              disabled={isFirstImage}
              className={cn(
                "absolute left-4 p-3 rounded-full transition-all",
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
                "absolute right-4 p-3 rounded-full transition-all",
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

      {/* Footer avec filmstrip/thumbnails */}
      {attachments.length > 1 && (
        <div className="border-t border-white/10 bg-black/50 p-4 overflow-x-auto">
          <div className="flex gap-2 relative">
            {attachments.map((attachment, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentIndex(index);
                  setZoomLevel(1);
                  setIsZoomed(false);
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
                      className="w-20 h-20 object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="w-0 h-0 border-l-6 border-l-transparent border-r-6 border-r-transparent border-t-10 border-t-white/70 opacity-60"></div>
                    </div>
                  </>
                ) : (
                  <img
                    src={attachment.url}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-20 h-20 object-cover"
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
