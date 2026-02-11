"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { MessageAttachment } from "@/lib/types"; // Assurez-vous que ce chemin correspond à votre projet
import { cn } from "@/lib/utils";

interface MediaCarouselProps {
  attachments: MessageAttachment[];
  initialIndex: number;
  onClose: () => void;
}

export default function MediaCarousel({
  attachments,
  initialIndex,
  onClose,
}: MediaCarouselProps) {
  const [index, setIndex] = useState(initialIndex);
  const [direction, setDirection] = useState(0); // -1 (gauche), 1 (droite)
  const [isZoomed, setIsZoomed] = useState(false);
  
  // Pour gérer les événements clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") paginate(-1);
      if (e.key === "ArrowRight") paginate(1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [index, onClose]);

  // Fonction de changement de slide
  const paginate = (newDirection: number) => {
    // Si on est zoomé, on empêche le changement de slide pour éviter les conflits
    if (isZoomed) {
      setIsZoomed(false);
      // Petit délai pour laisser le dézoom se faire avant de changer
      setTimeout(() => {
        const newIndex = index + newDirection;
        if (newIndex >= 0 && newIndex < attachments.length) {
          setDirection(newDirection);
          setIndex(newIndex);
        }
      }, 200);
      return;
    }

    const newIndex = index + newDirection;
    // Logique "Ressort" aux extrémités :
    // Si on essaie d'aller avant 0 ou après la fin, on ne change pas l'index.
    // L'effet visuel de "résistance" est géré par le dragElastic du composant motion.div
    if (newIndex >= 0 && newIndex < attachments.length) {
      setDirection(newDirection);
      setIndex(newIndex);
    }
  };

  const currentMedia = attachments[index];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
    >
      {/* Contrôles Haut (Fermer) */}
      <div className="absolute top-4 right-4 z-50 flex gap-4">
         {currentMedia.type !== "VIDEO" && (
            <button
              onClick={() => setIsZoomed(!isZoomed)}
              className="p-2 rounded-full bg-black/50 text-white hover:bg-white/20 transition-colors"
            >
              {isZoomed ? <ZoomOut size={24} /> : <ZoomIn size={24} />}
            </button>
         )}
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-black/50 text-white hover:bg-red-500/80 transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {/* Navigation Gauche */}
      {index > 0 && (
        <button
          onClick={() => paginate(-1)}
          className="absolute left-4 z-40 p-3 rounded-full bg-black/50 text-white hover:bg-white/20 transition-colors max-sm:hidden"
        >
          <ChevronLeft size={32} />
        </button>
      )}

      {/* Navigation Droite */}
      {index < attachments.length - 1 && (
        <button
          onClick={() => paginate(1)}
          className="absolute right-4 z-40 p-3 rounded-full bg-black/50 text-white hover:bg-white/20 transition-colors max-sm:hidden"
        >
          <ChevronRight size={32} />
        </button>
      )}

      {/* Zone Principale */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        <AnimatePresence initial={false} custom={direction}>
          <Slide
            key={index}
            attachment={currentMedia}
            direction={direction}
            paginate={paginate}
            index={index}
            total={attachments.length}
            isZoomed={isZoomed}
            setIsZoomed={setIsZoomed}
          />
        </AnimatePresence>
      </div>

      {/* Indicateur de position */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm font-medium bg-black/50 px-3 py-1 rounded-full">
        {index + 1} / {attachments.length}
      </div>
    </motion.div>
  );
}

// Composant interne pour gérer la logique complexe de chaque Slide (Zoom + Drag)
function Slide({
  attachment,
  direction,
  paginate,
  index,
  total,
  isZoomed,
  setIsZoomed,
}: {
  attachment: MessageAttachment;
  direction: number;
  paginate: (dir: number) => void;
  index: number;
  total: number;
  isZoomed: boolean;
  setIsZoomed: (v: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const scale = useMotionValue(1);
  
  // Variantes pour l'animation de transition (Slide effect)
  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
      scale: 0.8, // Petit effet de profondeur
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
      scale: 0.8,
    }),
  };

  // Gestion du glissement (Swipe) pour changer d'image
  // Ne s'active que si on n'est PAS zoomé
  const onDragEnd = (e: any, { offset, velocity }: any) => {
    if (isZoomed) return;

    const swipeConfidenceThreshold = 10000;
    const swipePower = Math.abs(offset.x) * velocity.x;

    if (swipePower < -swipeConfidenceThreshold) {
      paginate(1); // Suivant
    } else if (swipePower > swipeConfidenceThreshold) {
      paginate(-1); // Précédent
    } else {
        // Si on lâche mais qu'on a pas assez tiré, ça revient au centre grâce au layout animation
    }
  };

  // --- Gestion du Zoom Tactile (Pinch) ---
  const initialPinchDistance = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialPinchDistance.current = distance;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance.current !== null) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = distance - initialPinchDistance.current;
      
      // Facteur de sensibilité du pinch
      const newScale = Math.max(1, Math.min(4, scale.get() + delta * 0.01));
      scale.set(newScale);
      
      if (newScale > 1.1 && !isZoomed) setIsZoomed(true);
      if (newScale <= 1.1 && isZoomed) setIsZoomed(false);
      
      initialPinchDistance.current = distance;
    }
  };

  const onTouchEnd = () => {
    initialPinchDistance.current = null;
    // Si on relâche et que l'échelle est proche de 1, on reset
    if (scale.get() < 1.1) {
        setIsZoomed(false);
        scale.set(1);
    }
  };

  // Double tap handler
  const handleDoubleTap = () => {
      if (isZoomed) {
          setIsZoomed(false);
          scale.set(1);
      } else {
          setIsZoomed(true);
          scale.set(2.5);
      }
  };

  // Synchroniser l'état local isZoomed avec l'animation Framer Motion
  useEffect(() => {
      if (isZoomed) scale.set(2.5);
      else scale.set(1);
  }, [isZoomed, scale]);


  // Si c'est une vidéo, on affiche simplement le player (souvent moins interactif niveau zoom)
  if (attachment.type === "VIDEO") {
      return (
        <motion.div
            className="w-full max-w-5xl px-4 flex justify-center"
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            custom={direction}
            transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2} // Effet élastique sur les bords
            onDragEnd={onDragEnd}
        >
             <video 
                src={attachment.url} 
                controls 
                autoPlay 
                className="max-h-[80vh] max-w-full rounded-lg shadow-2xl bg-black"
            />
        </motion.div>
      )
  }

  // Si c'est une image
  return (
    <motion.div
      ref={containerRef}
      className={cn(
          "absolute w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing",
          isZoomed ? "cursor-move" : ""
      )}
      // Props de transition de slide
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      custom={direction}
      transition={{
        x: { type: "spring", stiffness: 300, damping: 30 }, // Transition fluide type "physique"
        opacity: { duration: 0.2 },
        scale: { duration: 0.4 } // Animation du zoom douce
      }}
      // Props de Drag (Swipe & Pan)
      drag={isZoomed ? true : "x"} // Si zoomé: drag libre (pan), sinon drag X (swipe)
      
      // LA CLEF : Contraintes de drag
      // Si PAS zoomé : contrainte 0 (lock au centre), mais dragElastic permet de tirer un peu (ressort)
      // Si ZOOMÉ : contrainte au containerRef (bords de l'écran), avec dragElastic pour le rebond sur les bords
      dragConstraints={isZoomed ? containerRef : { left: 0, right: 0 }}
      dragElastic={isZoomed ? 0.05 : 0.2} // Plus rigide quand zoomé, plus souple pour le swipe
      dragMomentum={isZoomed} // Inertie seulement quand on pan dans l'image
      
      onDragEnd={onDragEnd}
      // Props tactiles pour le Pinch-to-zoom
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onDoubleClick={handleDoubleTap}
      style={{ x, scale, touchAction: "none" }} // touchAction none est vital pour empêcher le scroll natif mobile
    >
      <img
        src={attachment.url}
        alt="Media view"
        draggable={false} // Empêcher le drag natif du navigateur sur l'image (fantôme)
        className={cn(
            "max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl select-none",
            // Quand zoomé, on enlève max-w/max-h pour permettre à l'image de grandir
            // Mais attention, pour que Framer calcule bien le scale, garder une base responsive est mieux.
            // Framer gère le scale via transform CSS, donc on garde les classes de base.
        )}
      />
    </motion.div>
  );
}