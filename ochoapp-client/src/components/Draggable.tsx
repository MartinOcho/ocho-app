/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface DraggableProps {
  draggable?: boolean;
  children: React.ReactNode;
  direction: "left" | "right" | "up" | "down";
  onDrag: (distance: number) => void;
  className?: string;
  contentClassName?: string;
}

export default function Draggable({
  draggable = true,
  children,
  direction,
  onDrag,
  className,
  contentClassName,
}: DraggableProps) {
  // const containerRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanscroll] = useState(true);
  const [dragging, setDragging] = useState(!canScroll);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const startPoint = useRef({ x: 0, y: 0 });
  const dragThreshold = 100; // Threshold to trigger `onDrag`

  const handleMouseDown = (e: MouseEvent) => {
    if (!draggable) return;
    // setDragging(true);
    startPoint.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging || !draggable) return;

    e.preventDefault(); // Empêche le comportement par défaut
    const deltaX = e.clientX - startPoint.current.x;
    const deltaY = e.clientY - startPoint.current.y;

    setTranslate((prev) => {
      const newTranslate = { ...prev };

      if (direction === "left" || direction === "right") {
        newTranslate.x =
          direction === "left" ? Math.min(deltaX, 0) : Math.max(deltaX, 0);
        newTranslate.y = 0; // Lock vertical movement
      } else if (direction === "up" || direction === "down") {
        newTranslate.y =
          direction === "up" ? Math.min(deltaY, 0) : Math.max(deltaY, 0);
        newTranslate.x = 0; // Lock horizontal movement
      }

      return newTranslate;
    });
  };

  const handleMouseUp = () => {
    setDragging(false);
    setCanscroll(true);
    const draggedDistance = Math.abs(
      direction === "left" || direction === "right" ? translate.x : translate.y,
    );

    // Trigger callback if threshold is reached
    if (draggedDistance >= dragThreshold) {
      onDrag(draggedDistance);
    }
    // Reset position
    const resetTimeout = setTimeout(() => setTranslate({ x: 0, y: 0 }), 300);
    return () => clearTimeout(resetTimeout);
  };

  const handleTouchStart = (e: TouchEvent) => {
    if (!draggable) return;
    const touch = e.touches[0];
    setDragging(!canScroll);
    startPoint.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove = (e: TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;
    setDragging(!canScroll);

    const touch = e.touches[0];
    const deltaX = touch.clientX - startPoint.current.x;
    const deltaY = touch.clientY - startPoint.current.y;

    // Déterminer la direction du scroll
    const scrollDirection =
      Math.abs(deltaX) > Math.abs(deltaY)
        ? deltaX > 0
          ? "right"
          : "left"
        : deltaY > 0
          ? "up"
          : "down";
    // Trouver tous les éléments scrollables
    const scrollableElements = Array.from(
      container.querySelectorAll("*"),
    ).filter((el) => {
      return isScrollable(el as HTMLElement, scrollDirection);
    });

    // Filtrer les éléments scrollables qui sont touchés
    const touchedScrollableElements = scrollableElements.filter((el) => {
      const rect = (el as HTMLElement).getBoundingClientRect();
      return (
        touch.clientX >= rect.left &&
        touch.clientX <= rect.right &&
        touch.clientY >= rect.top &&
        touch.clientY <= rect.bottom
      );
    });

    touchedScrollableElements.forEach((el) => {
      const element = el as HTMLElement;
      canScroll
        ? element.addEventListener(
            "touchmove",
            () => correctScroll(element, scrollDirection),
            { passive: false },
          )
        : element.removeEventListener("touchmove", () =>
            correctScroll(element, scrollDirection),
          );
      element.addEventListener("touchend", () =>
        correctScroll(element, scrollDirection),
      );
      element.addEventListener("touchcancel", () =>
        correctScroll(element, scrollDirection),
      );
      element.addEventListener("pointerover", () =>
        correctScroll(element, scrollDirection),
      );
      element.addEventListener("scrollend", () =>
        correctScroll(element, scrollDirection),
      );
    });

    if (!touchedScrollableElements.length) {
      setCanscroll(false);
      e.preventDefault();
    }

    if (!dragging || !draggable) return;

    setTranslate((prev) => {
      const newTranslate = { ...prev };

      if (direction === "left" || direction === "right") {
        newTranslate.x =
          direction === "left" ? Math.min(deltaX, 0) : Math.max(deltaX, 0);
        newTranslate.y = 0; // Verrouille le mouvement vertical
      } else if (direction === "up" || direction === "down") {
        newTranslate.y =
          direction === "up" ? Math.min(deltaY, 0) : Math.max(deltaY, 0);
        newTranslate.x = 0; // Verrouille le mouvement horizontal
      }
      return newTranslate;
    });
  };
  const correctScroll = (
    element: HTMLElement,
    dir: "up" | "down" | "left" | "right",
  ) => {
    const sens = dir === "up" || dir === "down" ? "vertical" : "horizontal";
    if (sens === "vertical") {
      if (element.scrollTop <= 1) {
        setCanscroll(dir === direction);
        return;
      }

      if (
        element.scrollTop >=
        element.scrollHeight - (element.clientHeight + 1)
      ) {
        setCanscroll(dir === direction);
        return;
      }
      setCanscroll(true);
    } else {
      if (element.scrollLeft <= 1) {
        setCanscroll(dir === direction);
        return;
      }
      if (
        element.scrollLeft >=
        element.scrollWidth - (element.clientWidth + 1)
      ) {
        setCanscroll(dir === direction);
        return;
      }
      setCanscroll(true);
    }
  };

  useEffect(() => {
    if (canScroll) {
      setTimeout(() => setTranslate({ x: 0, y: 0 }), 300);
    }
    setDragging(!canScroll);
  }, [canScroll, setTranslate]);

  // Ajout des écouteurs d'événements pour le drag
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("mousedown", handleMouseDown);
    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseUp);
    container.addEventListener("mouseup", handleMouseUp);
    container.addEventListener("mouseleave", handleMouseUp);

    container.addEventListener("touchstart", handleTouchStart);
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleMouseUp);
    container.addEventListener("touchcancel", handleMouseUp);

    return () => {
      container.removeEventListener("mousedown", handleMouseDown);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseup", handleMouseUp);
      container.removeEventListener("mouseleave", handleMouseUp);

      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleMouseUp);
      container.removeEventListener("touchcancel", handleMouseUp);
    };
  }, [
    dragging,
    draggable,
    direction,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
  ]);

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
    >
      <div
        className={cn(
          "h-full w-full select-none transition-transform duration-200 ease-out",
          contentClassName,
        )}
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px)`,
          cursor: draggable ? (dragging ? "grabbing" : "grab") : "default",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Fonction externe pour vérifier si un élément est scrollable dans une direction donnée
const isScrollable = (
  element: HTMLElement,
  direction: "up" | "down" | "left" | "right",
): boolean => {
  if (direction === "up" || direction === "down") {
    const canScrollUp = element.scrollTop > 0;
    const canScrollDown =
      element.scrollTop < element.scrollHeight - element.clientHeight;
    return (
      (direction === "up" && canScrollUp) ||
      (direction === "down" && canScrollDown)
    );
  } else if (direction === "left" || direction === "right") {
    const canScrollLeft = element.scrollLeft > 0;
    const canScrollRight =
      element.scrollLeft < element.scrollWidth - element.clientWidth;
    return (
      (direction === "left" && canScrollLeft) ||
      (direction === "right" && canScrollRight)
    );
  }
  return false;
};

// Fonction récursive pour vérifier si un élément ou ses enfants sont scrollables dans une direction donnée
const isAnyScrollable = (
  element: HTMLElement,
  direction: "up" | "down" | "left" | "right",
): boolean => {
  if (isScrollable(element, direction)) {
    return true;
  }

  for (let child of element.children) {
    if (isAnyScrollable(child as HTMLElement, direction)) {
      return true;
    }
  }

  return false;
};
