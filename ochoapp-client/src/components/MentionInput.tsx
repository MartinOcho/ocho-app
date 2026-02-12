"use client";

import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import UserAvatar from "@/components/UserAvatar";
import { LinkifyTextarea } from "./LinkifyTextarea"; 

interface RoomMember {
  userId?: string | null;
  user?: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl?: string | null;
  } | null;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  members?: RoomMember[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minHeight?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

interface MentionSuggestion {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
}

export default function MentionInput({
  value,
  onChange,
  members = [],
  placeholder = "",
  className,
  disabled = false,
  minHeight = 80,
  onKeyDown: onKeyDownProp,
}: MentionInputProps) {
  const containerRef = useRef<HTMLDivElement>(null); // Ref vers la div conteneur
  const editorRef = useRef<HTMLDivElement>(null);    // Ref vers l'éditeur (div contenteditable)
  
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<MentionSuggestion[]>([]);
  const [currentMentionQuery, setCurrentMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [suggestionIndex, setSuggestionIndex] = useState(0);

  // Extraire les suggestions
  const memberSuggestions: MentionSuggestion[] = React.useMemo(() => {
    return members
      .filter((m) => m.user && m.userId)
      .map((m) => ({
        userId: m.userId!,
        displayName: m.user!.displayName,
        username: m.user!.username,
        avatarUrl: m.user!.avatarUrl,
      }));
  }, [members]);

  // Fonction utilitaire pour obtenir la position du curseur dans une div contentEditable
  const getCaretIndex = (element: HTMLElement) => {
    let position = 0;
    const isSupported = typeof window.getSelection !== "undefined";
    if (isSupported) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount !== 0) {
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        position = preCaretRange.toString().length;
      }
    }
    return position;
  };

  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    
    // On attend le prochain tick pour que le DOM soit à jour si nécessaire
    requestAnimationFrame(() => {
        if (!editorRef.current) return;
        const caretPos = getCaretIndex(editorRef.current);
        detectMention(newValue, caretPos);
    });
  };

  const detectMention = (text: string, cursorPos: number) => {
    const textBeforeCursor = text.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex === -1) {
      closeSuggestions();
      return;
    }

    // Vérifier si le @ est déjà dans une structure de mention existante (optionnel, 
    // mais le regex complexe est souvent overkill ici si on veut juste de la réactivité)
    
    // Texte après le @
    const query = textBeforeCursor.substring(lastAtIndex + 1);

    // Regex permissif : lettres, chiffres, underscores, espaces (pour prénoms composés)
    if (!/^[a-zA-Z0-9_\-\s]*$/.test(query)) {
      closeSuggestions();
      return;
    }

    const filtered = memberSuggestions.filter(
      (member) =>
        member.displayName.toLowerCase().includes(query.toLowerCase().trim()) ||
        member.username.toLowerCase().includes(query.toLowerCase().trim())
    );

    if (filtered.length > 0) {
        setMentionStartIndex(lastAtIndex);
        setCurrentMentionQuery(query);
        setFilteredSuggestions(filtered);
        setSuggestionIndex(0);
        setShowMentionSuggestions(true);
    } else {
        closeSuggestions();
    }
  };

  const closeSuggestions = () => {
    setShowMentionSuggestions(false);
    setMentionStartIndex(-1);
    setFilteredSuggestions([]);
  };

  const insertMention = (member: MentionSuggestion) => {
    if (mentionStartIndex === -1 || !editorRef.current) return;

    // Attention: value contient le texte brut
    const beforeMention = value.substring(0, mentionStartIndex);
    // On coupe après la requête (longueur du query + 1 pour le '@')
    const afterMention = value.substring(mentionStartIndex + currentMentionQuery.length + 1);

    const mentionText = `@[${member.displayName}](${member.userId}) `;
    const newValue = `${beforeMention}${mentionText}${afterMention}`;

    onChange(newValue);
    closeSuggestions();

    // Restaurer le focus et placer le curseur après la mention
    // Note: C'est complexe avec contentEditable car React va re-rendre le HTML
    // Le composant LinkifyTextarea gère le rendu HTML
    setTimeout(() => {
        if (editorRef.current) {
            editorRef.current.focus();
            // Tenter de placer le curseur à la fin (simplification)
            // Pour une vraie gestion fine, il faudrait un gestionnaire de Range complexe
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(editorRef.current);
            range.collapse(false); // false = fin
            selection?.removeAllRanges();
            selection?.addRange(range);
        }
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (showMentionSuggestions && filteredSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSuggestionIndex((prev) => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSuggestionIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredSuggestions[suggestionIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeSuggestions();
      }
    } else {
      onKeyDownProp?.(e);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <LinkifyTextarea
        ref={editorRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />

      {showMentionSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute bottom-full left-0 w-64 mb-1 bg-popover border border-input rounded-md shadow-lg z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="max-h-[200px] overflow-y-auto p-1">
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/30">
                Suggestions
            </div>
            {filteredSuggestions.map((suggestion, index) => (
              <button
                key={suggestion.userId}
                onClick={() => insertMention(suggestion)}
                onMouseEnter={() => setSuggestionIndex(index)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 text-left rounded-sm text-sm transition-colors",
                  index === suggestionIndex 
                    ? "bg-accent text-accent-foreground" 
                    : "text-popover-foreground hover:bg-muted"
                )}
              >
                <UserAvatar
                  avatarUrl={suggestion.avatarUrl}
                  size={24}
                  userId={suggestion.userId}
                />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-medium truncate">
                    {suggestion.displayName}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    @{suggestion.username}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}