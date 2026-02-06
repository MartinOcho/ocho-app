"use client";

import { useEffect, useState, useRef } from "react";
import MenuBar from "@/app/(main)/MenuBar";
import { useMenuBar } from "@/context/MenuBarContext";
import { cn } from "@/lib/utils";

export default function BottomMenuBar() {
  const { isVisible: isContextVisible } = useMenuBar();
  const [isScrollingDown, setIsScrollingDown] = useState(false);
  const lastScrollY = useRef(new Map());

  useEffect(() => {
    const handleScroll = (event: Event) => {
      const target = event.target as HTMLElement;
      if (!target || target.nodeType !== 1) return; // Sécurité pour les nodes

      const rect = target.getBoundingClientRect();
      const touchesBottom = rect.bottom >= window.innerHeight - 10;
      if (!touchesBottom) return;

      const currentScrollY = target.scrollTop;
      const previousScrollY = lastScrollY.current.get(target) || 0;

      // Seuil de 10px pour éviter les micro-sauts
      if (currentScrollY > previousScrollY + 10) {
        setIsScrollingDown(true);
      } else if (currentScrollY < previousScrollY - 10) {
        setIsScrollingDown(false);
      }

      // Optionnel : Forcer l'affichage si on remonte tout en haut
      if (currentScrollY <= 0) setIsScrollingDown(false);

      lastScrollY.current.set(target, currentScrollY);
    };

    // --- LOGIQUE DE RÉAPPARITION AUTOMATIQUE ---
    const checkScrollability = (mutations: MutationRecord[]) => {
      mutations.forEach((mutation) => {
        const target = mutation.target as HTMLElement;
        // Si l'élément n'est plus scrollable (contenu réduit), on réaffiche la barre
        if (target.scrollHeight <= target.clientHeight) {
          setIsScrollingDown(false);
        }
      });
    };

    const observer = new MutationObserver(checkScrollability);

    // On observe le body ou un container principal pour les changements de structure
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      observer.disconnect();
    };
  }, []);

  const showBar = isContextVisible && !isScrollingDown;

  return (
    <div
      className={cn(
        "fixed bottom-0 z-50 w-full p-3 transition-transform duration-300 ease-in-out sm:hidden",
        !showBar ? "translate-y-full" : "translate-y-0"
      )}
    >
      <MenuBar className="bg-card/50 backdrop-blur-md p-1 rounded-[1.65rem] border shadow-lg" />
    </div>
  );
}