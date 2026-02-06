"use client";

import { useEffect, useState, useRef } from "react";
import MenuBar from "@/app/(main)/MenuBar";
import { useMenuBar } from "@/context/MenuBarContext";
import { cn } from "@/lib/utils";

export default function BottomMenuBar() {
  const { isVisible: isContextVisible } = useMenuBar();
  const [isScrollingDown, setIsScrollingDown] = useState(false);
  const lastScrollY = useRef(new Map()); // On stocke le dernier scroll par élément

  useEffect(() => {
    const handleScroll = (event: Event) => {
      // On récupère l'élément qui est en train de scroller
      const target = event.target as HTMLElement;
      if (!target || target === (document as unknown as HTMLElement)) return;

      // On vérifie si l'élément touche le bas de la viewport
      const rect = target.getBoundingClientRect();
      const touchesBottom = rect.bottom >= window.innerHeight - 10;

      if (!touchesBottom) return;

      const currentScrollY = target.scrollTop;
      const previousScrollY = lastScrollY.current.get(target) || 0;

      // 1. Détection de la direction
      if (currentScrollY > previousScrollY + 10) {
        setIsScrollingDown(true);
      } else if (currentScrollY < previousScrollY - 10) {
        setIsScrollingDown(false);
      }

      // 2. Cas spécifique : Fin de scroll de l'élément
      const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
      if (isAtBottom) {
        setIsScrollingDown(true);
      }

      lastScrollY.current.set(target, currentScrollY);
    };

    // 'true' active la phase de capture : on écoute tous les scrolls du DOM
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, []);

  const showBar = isContextVisible && !isScrollingDown;

  return (
    <div
      className={cn(
        "fixed bottom-0 z-50 inline-flex min-h-fit w-full max-w-full justify-around gap-0 overflow-x-hidden p-3 transition-transform duration-300 ease-in-out sm:hidden",
        !showBar ? "translate-y-full" : "translate-y-0"
      )}
    >
      <MenuBar
        className={cn(
          "inline-flex min-h-fit w-full max-w-full justify-around gap-0 overflow-x-hidden bg-card/50 backdrop-blur-md p-1 rounded-[1.65rem] border shadow-lg"
        )}
      />
    </div>
  );
}