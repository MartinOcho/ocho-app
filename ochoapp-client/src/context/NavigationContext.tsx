"use client"

import { NavigationContextType, NavigationType } from "@/lib/types";
import { createContext, useContext, useState } from "react";


export const NavigationContext = createContext<NavigationContextType | undefined>(undefined);
  
export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within a NavigationProvider");
  }
  return context;
}


export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [currentNavigation, setCurrentNavigation] = useState<NavigationType>(null);

  return (
    <NavigationContext.Provider value={{ currentNavigation, setCurrentNavigation }}>
      {children}
    </NavigationContext.Provider>
  );
}