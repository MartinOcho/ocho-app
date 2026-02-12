import { useState, useCallback } from "react";
import { MentionedUser } from "@/lib/types";

interface MentionState {
  isActive: boolean;
  searchQuery: string;
  position: { top: number; left: number };
  triggerIndex: number | null; // Position de l'index du '@' dans la chaîne globale
}

const initialState: MentionState = {
  isActive: false,
  searchQuery: "",
  position: { top: 0, left: 0 },
  triggerIndex: null,
};

export function useMentions() {
  const [mentionState, setMentionState] = useState<MentionState>(initialState);
  const [mentionedUsers, setMentionedUsers] = useState<MentionedUser[]>([]);

  // Détecte si le curseur est positionné après un déclencheur '@'
  const detectMentionStart = useCallback(
    (
      text: string,
      cursorPos: number,
      element?: HTMLElement // L'élément contentEditable ou input pour calculer la position
    ) => {
      // 1. Obtenir le texte jusqu'au curseur
      const textUpToCursor = text.slice(0, cursorPos);

      // 2. Regex pour trouver le dernier '@' qui est soit au début, soit précédé d'un espace
      // On cherche un '@' suivi de caractères alphanumériques (la recherche)
      const mentionRegex = /(?:\s|^)(@)(\w*)$/;
      const match = textUpToCursor.match(mentionRegex);

      if (match) {
        // match[1] est le '@', match[2] est la requête (ex: 'dav')
        const query = match[2];
        const lastAtPos = textUpToCursor.lastIndexOf("@");

        // 3. Calculer la position visuelle pour l'overlay
        let position = { top: 0, left: 0 };
        
        if (typeof window !== "undefined" && element) {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0).cloneRange();
            // On essaie de positionner sur le curseur
            const rect = range.getBoundingClientRect();
            
            // Si rect est vide (parfois le cas sur curseur vide), on fallback sur l'élément
            if (rect.width === 0 && rect.height === 0) {
               const elRect = element.getBoundingClientRect();
               position = {
                  top: elRect.top - 310, // Au-dessus (hauteur approx overlay)
                  left: elRect.left + 20
               };
            } else {
              // Positionner au-dessus du curseur (300px est la max-height de l'overlay)
              position = {
                top: rect.top - 10, // Un peu au-dessus du curseur
                left: rect.left,
              };
            }
          }
        }

        setMentionState({
          isActive: true,
          searchQuery: query,
          position,
          triggerIndex: lastAtPos,
        });
      } else {
        setMentionState((prev) => (prev.isActive ? initialState : prev));
      }
    },
    []
  );

  const clearMentionState = useCallback(() => {
    setMentionState(initialState);
  }, []);

  const addMentionedUser = useCallback((user: MentionedUser) => {
    setMentionedUsers((prev) => {
      if (prev.find((u) => u.id === user.id)) return prev;
      return [...prev, user];
    });
  }, []);

  const formatMention = (user: MentionedUser) => {
    return `@[${user.displayName}](${user.username})`;
  };

  return {
    mentionState,
    mentionedUsers,
    detectMentionStart,
    clearMentionState,
    addMentionedUser,
    formatMention,
    setMentionedUsers, // Utile pour reset lors de l'envoi
  };
}