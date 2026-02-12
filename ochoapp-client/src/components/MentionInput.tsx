"use client";

import React, { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import UserAvatar from "@/components/UserAvatar";

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
  maxRows?: number;
  minRows?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
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
  maxRows = 10,
  minRows = 1,
  onKeyDown: onKeyDownProp,
}: MentionInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<MentionSuggestion[]>([]);
  const [currentMentionQuery, setCurrentMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [suggestionIndex, setSuggestionIndex] = useState(0);

  // Extraire les suggestions des membres filtrés
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

  // Mettre à jour la position du curseur
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursorPos = e.target.selectionStart;
    
    onChange(newValue);
    setCursorPosition(newCursorPos);

    // Déterminer si l'utilisateur tape une mention
    detectMention(newValue, newCursorPos);
  };

  const detectMention = (text: string, cursorPos: number) => {
    // Chercher le dernier @ avant le curseur
    const textBeforeCursor = text.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex === -1) {
      setShowMentionSuggestions(false);
      setMentionStartIndex(-1);
      return;
    }

    // Vérifier que le @ n'est pas dans une mention déjà formatée
    // Format : @[name](userId)
    const mentionRegex = /@\[[^\]]*\]\([^)]*\)/g;
    let match;
    let isInMention = false;

    while ((match = mentionRegex.exec(text)) !== null) {
      if (lastAtIndex >= match.index && lastAtIndex < match.index + match[0].length) {
        isInMention = true;
        break;
      }
    }

    if (isInMention) {
      setShowMentionSuggestions(false);
      return;
    }

    // Obtenir le texte après le @
    const query = textBeforeCursor.substring(lastAtIndex + 1);

    // Vérifier si c'est du texte continu (alphanumériques, underscore, tirets, espaces)
    // Stopper si on rencontre un caractère spécial (sauf espace)
    if (!/^[a-zA-Z0-9_-\s]*$/.test(query)) {
      setShowMentionSuggestions(false);
      return;
    }

    // Filtrer les suggestions
    const filtered = memberSuggestions.filter(
      (member) =>
        member.displayName.toLowerCase().includes(query.toLowerCase().trim()) ||
        member.username.toLowerCase().includes(query.toLowerCase().trim())
    );

    setMentionStartIndex(lastAtIndex);
    setCurrentMentionQuery(query);
    setFilteredSuggestions(filtered);
    setSuggestionIndex(0);
    setShowMentionSuggestions(filtered.length > 0 && query.trim().length > 0);
  };

  const insertMention = (member: MentionSuggestion) => {
    if (mentionStartIndex === -1) return;

    const beforeMention = value.substring(0, mentionStartIndex);
    const afterMention = value.substring(mentionStartIndex + currentMentionQuery.length + 1);

    // Insérer au format @[displayName](userId)
    const newValue = `${beforeMention}@[${member.displayName}](${member.userId}) ${afterMention}`;
    onChange(newValue);

    setShowMentionSuggestions(false);
    setMentionStartIndex(-1);
    setCurrentMentionQuery("");
    setSuggestionIndex(0);

    // Décaler le curseur après la mention
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeMention.length + `@[${member.displayName}](${member.userId}) `.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
        setShowMentionSuggestions(false);
      } else {
        onKeyDownProp?.(e);
      }
    } else {
      onKeyDownProp?.(e);
    }
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          "resize-none",
          className
        )}
        disabled={disabled}
        rows={minRows}
      />

      {/* Popover des suggestions */}
      {showMentionSuggestions && filteredSuggestions.length > 0 && (
        <div
          className="absolute bottom-full left-0 w-full mb-1 bg-popover border border-input rounded-md shadow-lg z-50"
        >
          <div className="max-h-[300px] overflow-y-auto">
            {filteredSuggestions.map((suggestion, index) => (
              <button
                key={suggestion.userId}
                onClick={() => insertMention(suggestion)}
                onMouseEnter={() => setSuggestionIndex(index)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-left transition-colors",
                  index === suggestionIndex 
                    ? "bg-accent" 
                    : "hover:bg-accent/50"
                )}
              >
                <UserAvatar
                  avatarUrl={suggestion.avatarUrl}
                  size={24}
                  userId={suggestion.userId}
                />
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-sm truncate">
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
