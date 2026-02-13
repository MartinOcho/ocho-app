"use client";

import React, { useState, useRef } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<MentionSuggestion[]>([]);
  const [currentMentionQuery, setCurrentMentionQuery] = useState("");
  
  // Note: On stocke maintenant l'index dans le texte BRUT
  const [mentionStartRawIndex, setMentionStartRawIndex] = useState(-1);
  const [suggestionIndex, setSuggestionIndex] = useState(0);

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

  const getRawTextBeforeCaret = (root: HTMLElement): string => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return "";
    
    const range = selection.getRangeAt(0);
    // Si le curseur n'est pas dans notre éditeur, on renvoie vide
    if (!root.contains(range.startContainer)) return "";

    // On crée un range qui représente la position du curseur
    const caretRange = range.cloneRange();
    caretRange.collapse(true);

    let raw = "";
    let stopTraversal = false;

    // Fonction récursive pour parcourir le DOM comme le fait LinkifyTextarea
    const traverse = (node: Node) => {
      if (stopTraversal) return;

      // Créer un range pour le noeud actuel pour comparer sa position avec le curseur
      const nodeRange = document.createRange();
      nodeRange.selectNode(node);

      // Si le noeud est entièrement APRÈS le curseur, on arrête tout
      const compareStart = caretRange.compareBoundaryPoints(Range.START_TO_START, nodeRange);
      if (compareStart <= 0) {
        // Le curseur est au début ou avant ce noeud (sauf si on est DANS ce noeud, géré plus bas)
        // Cas spécial : si on est DANS un noeud texte, compareBoundaryPoints peut être trompeur,
        // donc on gère le "Text Node" spécifiquement plus bas.
      }

      if (node.nodeType === Node.TEXT_NODE) {
        // Vérifier si le curseur est À L'INTÉRIEUR de ce noeud texte
        if (node === range.startContainer) {
          // On prend le texte jusqu'à l'offset du curseur
          raw += (node.textContent || "").substring(0, range.startOffset);
          stopTraversal = true; // On a atteint le curseur exact !
          return;
        } else if (caretRange.compareBoundaryPoints(Range.START_TO_START, nodeRange) > 0) {
          // Le curseur est après ce noeud texte complet
          raw += node.textContent || "";
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;

        // Si c'est une MENTION existante (on la traite comme un bloc atomique)
        if (el.dataset.mentionId) {
          // Si le curseur est après cette mention (cas normal)
          // On reconstruit le format brut de la mention
          if (caretRange.compareBoundaryPoints(Range.START_TO_START, nodeRange) > 0) {
             raw += `@[${el.dataset.mentionName}](${el.dataset.mentionId})`;
          }
          // Si le curseur est avant, on ne fait rien.
          // Note : On n'entre pas dans les enfants d'une mention
          return;
        }

        // Si c'est un BR
        if (el.tagName === "BR") {
           if (caretRange.compareBoundaryPoints(Range.START_TO_START, nodeRange) > 0) {
              raw += "\n";
           }
           return;
        }

        // Si c'est une DIV (comportement newline des navigateurs)
        // On doit traverser ses enfants
        const childNodes = Array.from(node.childNodes);
        childNodes.forEach(child => traverse(child));
        
        // Ajouter le saut de ligne de fin de DIV si nécessaire (comme dans LinkifyTextarea)
        // Seulement si on a parcouru le div entier sans s'arrêter au curseur
        if (!stopTraversal && el.tagName === "DIV") {
           // Vérification simplifiée pour éviter double newline en fin
           raw += "\n";
        }
      }
    };

    // Lancer la traversée
    Array.from(root.childNodes).forEach(child => traverse(child));

    // Petit nettoyage final si on a un newline en trop à la fin (similaire à LinkifyTextarea)
    if (raw.endsWith("\n") && raw.length > 1 && !stopTraversal) {
       // Cette condition est délicate car "stopTraversal" signifie qu'on est au milieu.
       // Ici, on retourne le brut partiel, donc on garde tel quel.
    }
    
    return raw;
  };

  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    
    // Détection asynchrone pour laisser le temps au DOM de se mettre à jour
    requestAnimationFrame(() => {
        if (!editorRef.current) return;
        
        // 1. On récupère le texte BRUT qui précède le curseur
        const rawTextBeforeCursor = getRawTextBeforeCaret(editorRef.current);
        
        // 2. On détecte la mention sur ce texte brut
        detectMention(rawTextBeforeCursor);
    });
  };

  const detectMention = (rawTextBeforeCursor: string) => {
    // On cherche le dernier @ dans le texte brut jusqu'au curseur
    const lastAtIndex = rawTextBeforeCursor.lastIndexOf("@");

    if (lastAtIndex === -1) {
      closeSuggestions();
      return;
    }

    // Le texte après le dernier @ (la requête)
    const query = rawTextBeforeCursor.substring(lastAtIndex + 1);

    // Validation : pas d'espaces multiples, caractères autorisés
    // Note : rawTextBeforeCursor peut contenir des newlines (\n), il faut s'assurer
    // que le @ n'est pas sur une ligne précédente éloignée.
    // Une façon simple est de vérifier s'il y a un saut de ligne dans la query
    if (query.includes("\n")) {
        closeSuggestions();
        return;
    }

    // Regex pour valider les caractères du nom d'utilisateur
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
        // lastAtIndex est maintenant un index correct dans la chaîne VALUE (Brute)
        setMentionStartRawIndex(lastAtIndex);
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
    setMentionStartRawIndex(-1);
    setFilteredSuggestions([]);
  };

  const insertMention = (member: MentionSuggestion) => {
    if (mentionStartRawIndex === -1 || !editorRef.current) return;

    // Ici, tout est plus simple car on travaille uniquement avec des index bruts
    const beforeMention = value.substring(0, mentionStartRawIndex);
    
    // On calcule la fin de la mention en se basant sur la longueur de la query actuelle
    // +1 pour le caractère '@'
    const endOfMentionIndex = mentionStartRawIndex + currentMentionQuery.length + 1;
    const afterMention = value.substring(endOfMentionIndex);

    const mentionText = `@[${member.displayName}](${member.userId}) `;
    const newValue = `${beforeMention}${mentionText}${afterMention}`;

    onChange(newValue);
    closeSuggestions();

    // Replacer le focus
    setTimeout(() => {
        if (editorRef.current) {
            editorRef.current.focus();
            // Placer le curseur à la fin est une solution de repli acceptable
            // Idéalement, on utiliserait une librairie de gestion de sélection,
            // mais c'est complexe à implémenter parfaitement sans libs externes.
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(editorRef.current);
            range.collapse(false); 
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
        minHeight={minHeight}
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