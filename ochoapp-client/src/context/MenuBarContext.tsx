"use client"

import { MenuBarContextType } from "@/lib/types";
import { createContext, useContext, useState } from "react";


export const MenuBarContext = createContext<MenuBarContextType | undefined>(undefined);
  
export function useMenuBar() {
  const context = useContext(MenuBarContext);
  if (!context) {
    throw new Error("useMenuBar must be used within a MenuBarProvider");
  }
  return context;
}

export function MenuBarProvider({ children }: { children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState<boolean>(true);

  return (
    <MenuBarContext.Provider value={{ isVisible, setIsVisible }}>
      {children}
    </MenuBarContext.Provider>
  );
}