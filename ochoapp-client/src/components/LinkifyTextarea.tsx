"use client";

import React, {
  useRef,
  useLayoutEffect,
  useState,
  useCallback,
  useEffect,
} from "react";
import { cn } from "@/lib/utils";

interface LinkifyTextareaProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: number;
}

export const LinkifyTextarea = React.forwardRef<HTMLDivElement, LinkifyTextareaProps>(
  ({ value, onChange, placeholder, className, disabled, minHeight = 80, ...props }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [isFocused, setIsFocused] = useState(false);

    // Pour éviter les mises à jour en boucle (boucle infinie de rendu)
    const isTypingRef = useRef(false);

    // ---------- 0. Helpers pour sauvegarde/restauration du caret (offset global) ----------
    const getCaretOffset = useCallback((): number => {
      const sel = window.getSelection();
      if (!sel || !sel.anchorNode) return 0;

      let offset = sel.anchorOffset;
      let node: Node | null = sel.anchorNode;

      // remonter jusqu'à editorRef en accumulant la longueur des précédents siblings
      while (node && node !== editorRef.current) {
        while (node.previousSibling) {
          node = node.previousSibling;
          offset += node.textContent?.length ?? 0;
        }
        node = node.parentNode;
      }

      return offset;
    }, []);

    const setCaretOffset = useCallback((targetOffset: number) => {
      const root = editorRef.current;
      if (!root) return;

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      let curOffset = 0;
      let node: Node | null = walker.nextNode();

      while (node) {
        const len = node.textContent?.length ?? 0;
        if (curOffset + len >= targetOffset) {
          const range = document.createRange();
          const sel = window.getSelection();
          range.setStart(node, Math.max(0, targetOffset - curOffset));
          range.collapse(true);
          sel?.removeAllRanges();
          sel?.addRange(range);
          return;
        }
        curOffset += len;
        node = walker.nextNode();
      }

      // Si on n'a pas trouvé (offset en fin), positionner à la fin
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(root);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }, []);

    // --- 1. CONVERSION DATA -> HTML (Pour l'affichage) ---
    const rawToHtml = useCallback((text: string) => {
      if (!text) return '<br class="ProseMirror-trailingBreak">';

      let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      // Transformation des Mentions : @[Display](id) -> HTML Span (global)
      html = html.replace(
        /@\[([^\]]+)\]\(([^)]+)\)/g,
        (match, name, id) => {
          return `<span data-mention-id="${id}" data-mention-name="${name}" contenteditable="false" class="mention-node inline-block bg-primary/10 rounded-sm text-primary px-0.5 mx-0.5 font-semibold select-none cursor-pointer hover:bg-primary/20 transition-colors">@${name}</span>`;
        }
      );

      // Hashtags (Simple styling)
      html = html.replace(/(?<!\w)#(\w+)/g, '<span class="text-blue-500 font-medium">#$1</span>');

      // URLs
      html = html.replace(/(https?:\/\/[^\s]+)/g, '<span class="text-blue-500 underline decoration-blue-500/30">$1</span>');

      return html.replace(/\n/g, "<br/>");
    }, []);

    const htmlToRaw = useCallback((container: HTMLElement) => {
       if (
        container.childNodes.length === 1 &&
        container.childNodes[0].nodeType === Node.ELEMENT_NODE &&
        (container.childNodes[0] as HTMLElement).tagName.toLocaleLowerCase() === "br"
      ) {
        return "";
      }

      let raw = "";

      const traverse = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          raw += node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;

          // Si c'est une mention (détectée via dataset)
          if (el.dataset.mentionId) {
            raw += `@[${el.dataset.mentionName}](${el.dataset.mentionId})`;
            return; // On n'entre pas dans les enfants de la mention (atomique)
          }

          // BR => newline
          if (el.tagName === "BR") {
            raw += "\n";
            return;
          }

          // DIV: certains navigateurs insèrent des DIV pour lignes
          if (el.tagName === "DIV") {
            // si DIV a des enfants, on itère puis ajoute un newline s'il n'est pas le dernier
            el.childNodes.forEach(traverse);
            // ajout d'un newline seulement si ce n'est pas la fin du container
            raw += "\n";
            return;
          }

          // Pour les autres éléments, on descend
          el.childNodes.forEach(traverse);
        }
      };

      container.childNodes.forEach(traverse);
      if (raw.endsWith("\n") && raw.length > 1) {
        raw = raw.replace(/\n$/, "");
      }

      return raw;
    }, []);

    // --- 3. SYNCHRONISATION INITIALE & EXTERNE ---
    useLayoutEffect(() => {
      // On expose la ref
      if (typeof ref === "function") {
        ref(editorRef.current);
      } else if (ref) {
        ref.current = editorRef.current;
      }
    }, [ref]);

   
    useEffect(() => {
      if (!editorRef.current) return;

      const editor = editorRef.current;
      const currentRaw = htmlToRaw(editor);
      console.log(currentRaw);
      

      if (currentRaw !== value && !isTypingRef.current) {
        
        const caret = getCaretOffset();
        
        editor.innerHTML = rawToHtml(value);
        
        requestAnimationFrame(() => {
          setCaretOffset(caret);
        });
      }
    }, [value, htmlToRaw, rawToHtml, getCaretOffset, setCaretOffset]);

    // --- 4. GESTIONNAIRES D'ÉVÉNEMENTS ---
    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
      isTypingRef.current = true;
      const newRawValue = htmlToRaw(e.currentTarget as HTMLElement);
      onChange(newRawValue);

      // Petit hack pour reset le flag de typing après un court délai
      setTimeout(() => {
        isTypingRef.current = false;
      }, 120);
    };

    // Cherche le noeud élément précédent utile (saute les text nodes vides / whitespace)
    const findPreviousSiblingNonEmpty = (node: Node | null): Node | null => {
      let prev = node?.previousSibling ?? null;
      while (prev) {
        // si élément mention return
        if (prev.nodeType === Node.ELEMENT_NODE) return prev;
        // si text non vide return
        if (prev.nodeType === Node.TEXT_NODE && (prev.textContent ?? "").length > 0) return prev;
        prev = prev.previousSibling;
      }
      return null;
    };

    // LOGIQUE SPÉCIALE BACKSPACE
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Backspace") {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        let prevNode: Node | null = null;

        if (range.collapsed) {
          if (range.startContainer.nodeType === Node.TEXT_NODE) {
            if (range.startOffset === 0) {
              // le texte commence ici, vérifier previous sibling(s)
              prevNode = findPreviousSiblingNonEmpty(range.startContainer);
            } else {
              prevNode = null;
            }
          } else if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
            const parent = range.startContainer as HTMLElement;
            const idx = range.startOffset;
            if (idx > 0) {
              // enfant précédent potentiellement une mention
              prevNode = parent.childNodes[idx - 1];
              // si text node vide, essayer de remonter pour trouver element mention
              if (prevNode && prevNode.nodeType === Node.TEXT_NODE && (prevNode.textContent ?? "").trim() === "") {
                prevNode = findPreviousSiblingNonEmpty(prevNode);
              }
            } else {
              // startOffset === 0 : regarder previous siblings du parent (ex: caret au début d'une ligne)
              prevNode = findPreviousSiblingNonEmpty(parent);
            }
          }
        }

        // Vérification si le noeud précédent est notre span mention
        if (prevNode && prevNode.nodeType === Node.ELEMENT_NODE) {
          const el = prevNode as HTMLElement;
          if (el.dataset.mentionId) {
            // C'EST UNE MENTION !
            e.preventDefault(); // On empêche la suppression standard (qui supprimerait tout le bloc)

            // 1. On crée un noeud texte avec "@"
            const atTextNode = document.createTextNode("@");

            // 2. On remplace la mention par le "@"
            el.parentNode?.replaceChild(atTextNode, el);

            // 3. On place le curseur APRÈS le "@"
            const newRange = document.createRange();
            newRange.setStartAfter(atTextNode);
            newRange.collapse(true);

            selection.removeAllRanges();
            selection.addRange(newRange);

            // 4. On déclenche manuellement le onChange car on a modifié le DOM programmatiquement
            if (editorRef.current) {
              const newRawValue = htmlToRaw(editorRef.current);
              onChange(newRawValue);
            }
          }
        }
      }
    };

    const handleBlur = () => {
      setIsFocused(false);
      isTypingRef.current = false;
      // Optionnel : reformat sur blur si tu veux
      // if (editorRef.current) editorRef.current.innerHTML = rawToHtml(value);
    };

    return (
      <div
        className={cn(
          "relative flex w-full resize-none overflow-hidden overflow-y-auto rounded-sm border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          `min-h-[${minHeight}px]`,
          className
        )}
      >
        {/* Placeholder simulé (affiché seulement si la valeur est vide) */}
        {!value && (
          <div className="absolute inset-0 left-1 py-2 text-muted-foreground pointer-events-none select-none text-sm z-0">
            {placeholder}
          </div>
        )}

        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning={true}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          className={cn(
            "outline-none whitespace-pre-wrap break-words w-full h-full min-h-full min-w-full cursor-text overflow-hidden overflow-y-auto z-10",
            disabled && "cursor-not-allowed opacity-50"
          )}
          role="textbox"
          aria-multiline="true"
          {...props}
        />
      </div>
    );
  }
);

LinkifyTextarea.displayName = "LinkifyTextarea";
