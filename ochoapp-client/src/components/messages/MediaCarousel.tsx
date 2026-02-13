
  import React, { useState, useEffect, useRef, useCallback } from "react";
  import { motion, AnimatePresence, useMotionValue } from "framer-motion";
  import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download } from "lucide-react";
  import { MessageAttachment } from "@/lib/types";
  import { cn } from "@/lib/utils";
  import { useActiveRoom } from "@/context/ChatContext";

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
    const { setIsMediaFullscreen } = useActiveRoom();
    const [index, setIndex] = useState(Math.max(0, initialIndex));
    const [direction, setDirection] = useState(0);
    const [isZoomed, setIsZoomed] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const filmstripRef = useRef<HTMLDivElement>(null);
    const currentThumbnailRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
      setIsMediaFullscreen(true);
      return () => setIsMediaFullscreen(false);
    }, [setIsMediaFullscreen]);

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") handleClose();
        if (e.key === "ArrowLeft") paginate(-1);
        if (e.key === "ArrowRight") paginate(1);
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [index]);

    // Scroll filmstrip to current thumbnail
    useEffect(() => {
      if (currentThumbnailRef.current && filmstripRef.current) {
        const thumb = currentThumbnailRef.current;
        const strip = filmstripRef.current;
        const left = thumb.offsetLeft;
        const right = left + thumb.offsetWidth;
        const sLeft = strip.scrollLeft;
        const sRight = sLeft + strip.clientWidth;
        if (left < sLeft) strip.scrollLeft = left - 10;
        else if (right > sRight) strip.scrollLeft = right - strip.clientWidth + 10;
      }
    }, [index]);

    const handleClose = useCallback(() => {
      setIsMediaFullscreen(false);
      onClose();
    }, [onClose, setIsMediaFullscreen]);

    const paginate = (dir: number) => {
      if (isZoomed) {
        setIsZoomed(false);
        setTimeout(() => {
          const ni = index + dir;
          if (ni >= 0 && ni < attachments.length) {
            setDirection(dir);
            setIndex(ni);
          }
        }, 200);
        return;
      }
      const ni = index + dir;
      if (ni >= 0 && ni < attachments.length) {
        setDirection(dir);
        setIndex(ni);
      }
    };

    const download = () => {
      const current = attachments[index];
      if (!current?.url) return;
      const a = document.createElement("a");
      a.href = current.url;
      a.download = `media-${index}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    const current = attachments[index];
    if (!current) return null;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999999] flex flex-col bg-black/95 backdrop-blur-sm max-sm:w-screen max-sm:max-w-[100vw] max-sm:min-w-[100vw]"
      >
        <div className="flex items-center justify-between p-3 border-b border-white/10">
          <div className="flex items-center gap-3 text-white text-sm">
            <span className="font-medium">{index + 1} / {attachments.length}</span>
            {current?.type && <span className="text-white/50 text-xs">{current.type === 'VIDEO' ? 'Vidéo' : 'Image'}</span>}
          </div>

          <div className="flex items-center gap-2">
            {current.type !== 'VIDEO' && (
              <button onClick={() => setIsZoomed((v) => !v)} className="p-2 rounded-lg bg-black/50 text-white hover:bg-white/10">
                {isZoomed ? <ZoomOut size={18} /> : <ZoomIn size={18} />}
              </button>
            )}
            <button onClick={download} className="p-2 rounded-lg bg-black/50 text-white hover:bg-white/10">
              <Download size={18} />
            </button>
            <button onClick={handleClose} className="p-2 rounded-lg bg-black/50 text-white hover:bg-white/10">
              <X size={18} />
            </button>
          </div>
        </div>

        <div ref={wrapperRef} className="relative w-full h-full flex-1 flex items-center justify-center overflow-hidden">
          {/* Left/Right nav */}
          {index > 0 && (
            <button onClick={() => paginate(-1)} className="absolute left-4 z-50 p-3 rounded-full bg-black/50 text-white hover:bg-white/20">
              <ChevronLeft size={28} />
            </button>
          )}
          {index < attachments.length - 1 && (
            <button onClick={() => paginate(1)} className="absolute right-4 z-50 p-3 rounded-full bg-black/50 text-white hover:bg-white/20">
              <ChevronRight size={28} />
            </button>
          )}

          <AnimatePresence initial={false} custom={direction}>
            <Slide
              key={index}
              attachment={current}
              direction={direction}
              paginate={paginate}
              index={index}
              total={attachments.length}
              isZoomed={isZoomed}
              setIsZoomed={setIsZoomed}
              containerRef={wrapperRef}
            />
          </AnimatePresence>
        </div>

        {attachments.length > 1 && (
          <div className="border-t border-white/10 bg-black/50 p-2 flex-shrink-0">
            <div ref={filmstripRef} className="flex gap-1.5 overflow-x-auto pb-2 p-1 scroll-smooth">
              {attachments.map((att, i) => (
                <button
                  key={i}
                  ref={i === index ? currentThumbnailRef : null}
                  onClick={() => { setIndex(i); setDirection(i > index ? 1 : -1); }}
                  className={cn(
                    "relative flex-shrink-0 rounded overflow-hidden transition-all",
                    i === index ? "ring-2 ring-white/50 scale-105" : "opacity-60 hover:opacity-100"
                  )}
                >
                  {att.type === 'VIDEO' ? (
                    <video src={att.url} className="w-10 h-10 object-cover" />
                  ) : (
                    <img src={att.url} alt={`thumb-${i}`} className="w-10 h-10 object-cover" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  function Slide({
    attachment,
    direction,
    paginate,
    index,
    total,
    isZoomed,
    setIsZoomed,
    containerRef,
  }: {
    attachment: MessageAttachment;
    direction: number;
    paginate: (dir: number) => void;
    index: number;
    total: number;
    isZoomed: boolean;
    setIsZoomed: (v: boolean) => void;
    containerRef: React.RefObject<HTMLDivElement> | null;
  }) {
    const x = useMotionValue(0);
    const scale = useMotionValue(1);

    const variants = {
      enter: (dir: number) => ({ zIndex: 0, x: dir > 0 ? 1000 : -1000, opacity: 0, scale: 0.9 }),
      center: { zIndex: 2, x: 0, opacity: 1, scale: 1 },
      exit: (dir: number) => ({ zIndex: 0, x: dir < 0 ? 1000 : -1000, opacity: 0, scale: 0.9 }),
    };

    const onDragEnd = (e: any, { offset, velocity }: any) => {
      if (isZoomed) return;
      const swipeConfidenceThreshold = 10000;
      const swipePower = Math.abs(offset.x) * velocity.x;
      if (swipePower < -swipeConfidenceThreshold) paginate(1);
      else if (swipePower > swipeConfidenceThreshold) paginate(-1);
    };

    const initialPinchDistance = useRef<number | null>(null);

    const onTouchStart = (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        initialPinchDistance.current = d;
      }
    };

    const onTouchMove = (e: React.TouchEvent) => {
      if (e.touches.length === 2 && initialPinchDistance.current != null) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        const delta = d - initialPinchDistance.current;
        const newScale = Math.max(1, Math.min(4, scale.get() + delta * 0.01));
        scale.set(newScale);
        if (newScale > 1.1 && !isZoomed) setIsZoomed(true);
        if (newScale <= 1.1 && isZoomed) setIsZoomed(false);
        initialPinchDistance.current = d;
      }
    };

    const onTouchEnd = () => {
      initialPinchDistance.current = null;
      if (scale.get() < 1.1) { setIsZoomed(false); scale.set(1); }
    };

    const handleDoubleTap = () => {
      if (isZoomed) { setIsZoomed(false); scale.set(1); }
      else { setIsZoomed(true); scale.set(2.5); }
    };

    useEffect(() => { if (isZoomed) scale.set(2.5); else scale.set(1); }, [isZoomed, scale]);

    if (attachment.type === 'VIDEO') {
      return (
        <motion.div
          className="w-full max-w-5xl px-4 flex justify-center"
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          custom={direction}
          transition={{ x: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={onDragEnd}
        >
          <video src={attachment.url} controls autoPlay className="max-h-[80vh] max-w-full rounded-sm shadow-2xl bg-black object-contain" />
        </motion.div>
      );
    }

    return (
      <motion.div
        className={cn('absolute w-full h-full flex items-center justify-center', isZoomed ? 'cursor-move' : 'cursor-grab active:cursor-grabbing')}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        custom={direction}
        transition={{ x: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.2 }, scale: { duration: 0.4 } }}
        drag={isZoomed ? true : 'x'}
        dragConstraints={isZoomed && containerRef ? containerRef : { left: 0, right: 0 }}
        dragElastic={isZoomed ? 0.05 : 0.2}
        dragMomentum={isZoomed}
        onDragEnd={onDragEnd}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onDoubleClick={handleDoubleTap}
        style={{ x, scale, touchAction: 'none' }}
      >
        <img src={attachment.url} alt={`media-${index}`} draggable={false} className="max-h-[85vh] max-w-[90vw] object-contain rounded-sm shadow-2xl select-none" />
      </motion.div>
    );
  }
              