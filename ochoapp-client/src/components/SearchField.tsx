"use client";

import { useRouter } from "next/navigation";
import { Input } from "./ui/input";
import { SearchIcon, XIcon } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useSearch } from "@/context/SearchContext"; 
import { useProgress } from "@/context/ProgressContext";
import { useTranslation } from "@/context/LanguageContext";

export default function SearchField() {
  const { isSearchActive, setSearchActive } = useSearch(); // Use context instead of local state
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const {startNavigation: navigate} = useProgress();
  const { t } = useTranslation();
  const {search} = t();
  // ecouter isSesrchActive avec un use effect
  useEffect(() => {
    isSearchActive ? activeSearch() : hideSearch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSearchActive]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    activeSearch()
    const form = e.currentTarget;
    const q = (form.q as HTMLInputElement).value.trim();
    if (!q) return;
  
    const params = new URLSearchParams(window.location.search);
    params.set("q", q); // Ajoute ou met à jour le paramètre "q"
  
    navigate(`/search?${params.toString()}`);
  }
  

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInput(e.target.value);
  }

  function activeSearch() {
    setSearchActive(true); // Activate search globally
    inputRef.current?.focus();
  }

  function hideSearch() {
    if (!input.length) {
      setSearchActive(false); // Deactivate search globally
      inputRef.current?.blur();
    }
  }

  function clearSearch() {
    setInput("");
    hideSearch();
  }

  return (
    <form onSubmit={handleSubmit} method="GET" action="/search" ref={formRef}>
      <div className={cn("relative h-10")}>
        <Input
          ref={inputRef}
          name="q"
          placeholder={search}
          className={cn(
            "max-w-full pe-16 transition-all rounded-3xl",
            isSearchActive
              ? "max-sm:w-52"
              : "max-sm:pointer-events-none max-sm:absolute max-sm:w-0 max-sm:opacity-0",
          )}
          value={input}
          onChange={handleInputChange}
          onFocus={activeSearch}
          onBlur={hideSearch}
        />
        {!!input.length && isSearchActive && (
          <XIcon
            onClick={clearSearch}
            className="absolute right-10 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground"
          />
        )}
        <button type="submit">
        <SearchIcon
          size={40}
          className={cn(
            "absolute top-1/2 size-5 -translate-y-1/2 transform text-muted-foreground sm:right-3",
            isSearchActive && "right-3",
          )}
        />

        </button>
      </div>
    </form>
  );
}
