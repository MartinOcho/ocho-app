"use client";

import { useEffect, useState, useRef } from "react";
import MenuBar from "@/app/(main)/MenuBar";
import { useMenuBar } from "@/context/MenuBarContext";
import { cn } from "@/lib/utils";

export default function BottomMenuBar() {
  const { isVisible: isContextVisible } = useMenuBar();
  const [isScrollingDown, setIsScrollingDown] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    // On cible l'élément qui a l'overflow (ton <main> dans le layout)
    const mainElement = document.querySelector("main");
    if (!mainElement) return;

    const handleScroll = () => {
      const currentScrollY = mainElement.scrollTop;

      // 1. Détecte la direction du scroll
      // On ajoute une marge de 10px pour éviter les micro-sauts
      if (currentScrollY > lastScrollY.current + 10) {
        setIsScrollingDown(true); // On descend -> On cache
      } else if (currentScrollY < lastScrollY.current - 10) {
        setIsScrollingDown(false); // On monte -> On montre
      }

      // 2. Cas spécifique : Fin de page
      // Si on arrive tout en bas, on peut décider de la cacher complètement
      const isAtBottom = 
        mainElement.scrollHeight - mainElement.scrollTop <= mainElement.clientHeight + 50;
      
      if (isAtBottom) {
        setIsScrollingDown(true);
      }

      lastScrollY.current = currentScrollY;
    };

    mainElement.addEventListener("scroll", handleScroll);
    return () => mainElement.removeEventListener("scroll", handleScroll);
  }, []);

  // La barre est visible SI le contexte dit OK ET qu'on n'est pas en train de descendre
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
          "inline-flex min-h-fit w-full max-w-full justify-around gap-0 overflow-x-hidden bg-card/50 backdrop-blur-md p-1 rounded-3xl border shadow-lg"
        )}
      />
    </div>
  );
}