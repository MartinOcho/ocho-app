import { cn } from "@/lib/utils";
import React, { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Minus, Plus, RotateCcw } from "lucide-react";

interface ZoomableProps {
  children: React.ReactNode;
  zoomable?: boolean;
  clasName?: string;
}

export default function Zoomable({
  children,
  zoomable = true,
  clasName,
}: ZoomableProps) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [zoomToggleCount, setZoomToggleCount] = useState(0);
  const startPoint = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const initialDistance = useRef(0); // To store initial distance between touches
  const lastTap = useRef(0);

  const handleWheelZoom = (e: WheelEvent) => {
    if (!zoomable) return;
    e.preventDefault(); // Prevent page scrolling
    const zoomStep = 0.1;
    setScale((prevScale) =>
      Math.max(
        1,
        Math.min(5, prevScale + (e.deltaY > 0 ? -zoomStep : zoomStep)),
      ),
    );
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Calculate the initial distance between the two touches
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      initialDistance.current = dist; // Store the initial distance
    } else if (e.touches.length === 1) {
      handleStartDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );

      const zoomFactor = 0.01; // Adjust this factor for sensitivity
      const scaleChange = dist - initialDistance.current; // Change in distance
      setScale(
        (prevScale) =>
          Math.max(1, Math.min(5, prevScale + scaleChange * zoomFactor)), // Limit to 10
      );

      initialDistance.current = dist;
    } else if (e.touches.length === 1) {
      handleDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) =>
    handleStartDrag(e.clientX, e.clientY);
  const handleMouseMove = (e: React.MouseEvent) =>
    handleDrag(e.clientX, e.clientY);

  const handleStartDrag = (x: number, y: number) => {
    if (!zoomable || scale <= 1) return;
    setDragging(true);
    startPoint.current = { x: x - translate.x, y: y - translate.y };
  };

  const handleDrag = (x: number, y: number) => {
    if (!dragging || !zoomable || scale <= 1 || !containerRef.current) return;

    const container = containerRef.current.getBoundingClientRect();
    const element =
      containerRef.current.firstElementChild?.getBoundingClientRect();

    if (element) {
      const topGap = element.top - container.top;
      const bottomGap = container.bottom - element.bottom;
      const rightGap = element.right - container.right;
      const leftGap = container.left - element.left;

      const gaps = {
        top: topGap,
        right: rightGap,
        bottom: bottomGap,
        left: leftGap,
      };
      console.table(gaps);

      const newX = x - startPoint.current.x;
      const newY = y - startPoint.current.y;

      let constrainedX = translate.x;
      let constrainedY = translate.y;

      // Vérification des limites par direction
      if (leftGap > 0 || rightGap > 0) {
        constrainedX = newX; // Ajuster X uniquement si les gaps horizontaux le permettent
      }
      if (topGap < 0 || bottomGap < 0) {
        constrainedY = newY; // Ajuster Y uniquement si les gaps verticaux le permettent
      }

      // Stopper les déplacements lorsque les gaps sont <= 0
      if (leftGap <= 0 && newX > translate.x) {
        constrainedX = translate.x; // Stopper déplacement gauche -> droite
      }
      if (rightGap <= 0 && newX < translate.x) {
        constrainedX = translate.x; // Stopper déplacement droite -> gauche
      }
      if (topGap >= 0 && newY > translate.y) {
        constrainedY = translate.y; // Stopper déplacement haut -> bas
      }
      if (bottomGap >= 0 && newY < translate.y) {
        constrainedY = translate.y; // Stopper déplacement bas -> haut
      }

      // Appliquer les nouvelles valeurs
      setTranslate({ x: constrainedX, y: constrainedY });
    }
  };

  const correctPosition = () => {
    if (!containerRef.current) return;

    const container = containerRef.current.getBoundingClientRect();
    const element =
      containerRef.current.firstElementChild?.getBoundingClientRect();

    if (element) {
      const topGap = element.top - container.top;
      const bottomGap = container.bottom - element.bottom;
      const rightGap = element.right - container.right;
      const leftGap = container.left - element.left;

      let correctedX = translate.x;
      let correctedY = translate.y;

      // Corriger les gaps horizontaux
      if (leftGap < 0) correctedX += leftGap; // Ramener le bord gauche à zéro
      if (rightGap < 0) correctedX -= rightGap; // Ramener le bord droit à zéro

      // Corriger les gaps verticaux
      if (topGap > 0) correctedY -= topGap; // Ramener le bord supérieur à zéro
      if (bottomGap > 0) correctedY += bottomGap; // Ramener le bord inférieur à zéro

      setTranslate({ x: correctedX, y: correctedY });
    }
  };

  const zoomIn = () => {
    if (zoomable) setScale((prevScale) => Math.min(5, prevScale + 0.5));
  };

  const zoomOut = () => {
    if (zoomable && scale > 1)
      setScale((prevScale) => Math.max(1, prevScale - 0.5));
  };

  const resetZoom = () => scale !== 1 && setScale(1);
  const toggleZoom = () => {
    if (zoomable) {
      const zoomLevels = [
        { count: 0, scale: 2 },
        { count: 1, scale: 4 },
        { count: 2, scale: 1 }, // Remet à 1 après le reset
      ];
      const currentLevel = zoomLevels.find(
        (level) => level.count === zoomToggleCount,
      );

      if (currentLevel) {
        if (zoomToggleCount === 2 || scale >= 4) {
          setZoomToggleCount(0);
          resetZoom();
        } else {
          setZoomToggleCount(currentLevel.count + 1);
          setScale(currentLevel.scale);
        }
      }
    }
  };

  const handleMouseUp = () => {
    setDragging(false);
    correctPosition();
  };
  const handleTouchEnd = () => {
    setDragging(false);
    correctPosition();

    // Gestion du double tap
    const currentTime = new Date().getTime();
    const timeSinceLastTap = currentTime - lastTap.current;
    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      toggleZoom(); // Zoom avant/arrière
    }
    lastTap.current = currentTime;
  };

  useEffect(() => {
    if (!zoomable || scale <= 1) {
      setTranslate({ x: 0, y: 0 });
      setScale(1);
    }
  }, [scale, zoomable]);

  useEffect(() => {
    const container = containerRef.current;

    if (container) {
      // Use addEventListener for the wheel event
      container.addEventListener("wheel", handleWheelZoom, { passive: false });

      // Cleanup the event listener on unmount
      return () => {
        container.removeEventListener("wheel", handleWheelZoom);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomable]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative select-none overflow-hidden bg-background",
        clasName,
      )}
    >
      <div
        className={cn(
          zoomable && scale > 1 && "cursor-grab",
          "h-full w-full transition-transform duration-150",
        )}
        draggable
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onDoubleClick={toggleZoom}
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transition: "transform 0.1s ease-out",
        }}
      >
        {children}
      </div>
      {zoomable && (
        <div className="absolute bottom-16 right-4 flex space-x-2">
          <Button
            variant="outline"
            size="icon"
            onClick={resetZoom}
            title="Reinitialiser"
            disabled={scale === 1}
          >
            <RotateCcw />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={zoomOut}
            title="Réduire"
            disabled={scale <= 1}
          >
            <Minus />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={zoomIn}
            title="Agrandir"
            disabled={scale >= 5}
          >
            <Plus />
          </Button>
        </div>
      )}
    </div>
  );
}
