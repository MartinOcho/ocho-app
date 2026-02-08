import { useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";

interface InfiniteScrollContainerProps extends React.PropsWithChildren {
  onBottomReached: () => void;
  className?: string;
  reversed?: boolean;
}

export default function InfiniteScrollContainer({
  children,
  onBottomReached,
  className,
  reversed = false
}: InfiniteScrollContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const onBottomReachedRef = useRef(onBottomReached);

  // Mettre en cache le callback pour éviter les re-attachements
  useEffect(() => {
    onBottomReachedRef.current = onBottomReached;
  }, [onBottomReached]);

  // Détecte dynamiquement le parent scrollable
  useEffect(() => {
    if (containerRef.current) {
      setRoot(getScrollableParent(containerRef.current));
    }
  }, []);
  
  useEffect(() => {
    if(!root){
       return 
    }
    
    // Debounce pour éviter les appels répétés trop rapides
    let debounceTimer: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (reversed) {
          // Détection en haut pour un conteneur inversé (ajout d'anciens messages)
          if (root.scrollTop <= 300) {
            onBottomReachedRef.current();
          }
        } else {
          // Détection en bas pour un conteneur normal
          if (root.scrollTop + root.clientHeight >= root.scrollHeight - 300) {
            onBottomReachedRef.current();
          }
        }
      }, 100);
    };
    
    root.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      clearTimeout(debounceTimer);
      root.removeEventListener('scroll', handleScroll);
    };
  }, [root, reversed]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (containerRef.current) {
        setRoot(getScrollableParent(containerRef.current));
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current, {
        attributes: true,
        subtree: true,
      });
    }

    return () => observer.disconnect();
  }, []);

  const { ref } = useInView({
    root, // Définit dynamiquement le parent défilant comme racine
    rootMargin: "300px",
    onChange(inView) {
      if (inView) {
        onBottomReachedRef.current();
      }
    },
  });

  return (
    <div className={className} ref={containerRef}>
      {children}
      <div ref={ref} />
    </div>
  );
}

function getScrollableParent(element: HTMLElement | null): HTMLElement | null {
  if (!element) return null;
  const style = getComputedStyle(element);
  const overflowRegex = /(auto|scroll)/;
  

  if (
    overflowRegex.test(style.overflowY) ||
    overflowRegex.test(style.overflowX)
  ) {
    return element;
  }

  return getScrollableParent(element.parentElement);
}
