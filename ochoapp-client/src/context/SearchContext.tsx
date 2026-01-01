"use client";

import { createContext, useContext, useState } from "react";

type SearchContextType = {
  isSearchActive: boolean;
  setSearchActive: (active: boolean) => void;
};

export const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error("useSearch must be used within a SearchProvider");
  }
  return context;
}

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [isSearchActive, setSearchActive] = useState(false);

  return (
    <SearchContext.Provider value={{ isSearchActive, setSearchActive }}>
      {children}
    </SearchContext.Provider>
  );
}
