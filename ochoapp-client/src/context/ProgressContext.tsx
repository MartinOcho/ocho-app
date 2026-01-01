// context/ProgressContext.tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface ProgressContextType {
  progress: number;
  setProgress: (progress: number) => void;
  isPending: boolean;
  startNavigation: (path?: string) => void; // Le paramètre path est maintenant optionnel
}

const ProgressContext = createContext<ProgressContextType | undefined>(
  undefined,
);

export const ProgressProvider = ({ children }: { children: ReactNode }) => {
  const [progress, setProgress] = useState(0);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Fonction de routage personnalisée
  const startNavigation = (path?: string) => {
    if (isPending) return; // Éviter les déclenchements multiples

    startTransition(() => {
      setProgress(20);
      if (path) {
        router.push(path); // Naviguer vers une nouvelle route si un chemin est fourni
      } else {
        router.refresh(); // Rafraîchir la page actuelle si aucun chemin n'est fourni
      }
      setProgress(100);
    });
  };

  return (
    <ProgressContext.Provider
      value={{ progress, setProgress, isPending, startNavigation }}
    >
      <ProgressBar />
      {children}
    </ProgressContext.Provider>
  );
};

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error("useProgress must be used within a ProgressProvider");
  }
  return context;
};

function ProgressBar() {
  const { isPending } = useProgress();

  return (
    <div
      className={cn(
        "fixed left-0 top-0 z-50 w-full bg-muted transition-all duration-200",
        isPending ? "h-1" : "h-0",
      )}
    >
      <div className="h-full w-full overflow-hidden bg-primary/50">
        <div className="animate-progress origin-left-right h-full w-full bg-primary"></div>
      </div>
    </div>
  );
}
