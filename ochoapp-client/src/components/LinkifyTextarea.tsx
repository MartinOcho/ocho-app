import React, { useRef, useLayoutEffect, useEffect } from "react";
import { cn } from "@/lib/utils";

interface LinkifyTextareaProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: number;
}

// Regex pour détecter le format @[name](id)
const MENTION_REGEX = /@\[([^\]]+)\]\(([^)]+)\)/g;

export const LinkifyTextarea = React.forwardRef<HTMLDivElement, LinkifyTextareaProps>(
  ({ value, onChange, placeholder, className, disabled, minHeight = 80, ...props }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const isLockedRef = useRef(false); // Empêche la boucle infinie update -> render -> update

    const rawToHtml = (text: string) => {
      if (!text) return "";
      
      let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      // Transformation des mentions en span non-éditables
      html = html.replace(MENTION_REGEX, (match, name, id) => {
        // data-raw est crucial pour reconstruire la valeur plus tard
        // contentEditable="false" rend le bloc atomique (on ne peut pas éditer "John" sans casser le bloc)
        return `<span 
                  data-type="mention" 
                  data-id="${id}" 
                  data-name="${name}" 
                  data-raw="${match}"
                  contenteditable="false" 
                  class="inline-block bg-blue-100 text-blue-600 rounded px-1 mx-0.5 text-sm font-semibold select-none cursor-pointer hover:bg-blue-200 transition-colors"
                >@${name}</span>`;
      });

      // Gestion des retours à la ligne
      return html.replace(/\n/g, "<br>");
    };

    /**
     * Reconstruit le texte brut à partir du DOM
     * Parcourt les noeuds : Texte -> Texte, Span Mention -> Valeur brute @[name](id)
     */
    const domToRaw = (root: HTMLElement): string => {
        let raw = "";
        
        const traverse = (node: Node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                raw += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                if (el.tagName === "BR") {
                    raw += "\n";
                } else if (el.dataset.type === "mention" && el.dataset.raw) {
                    // C'est ici qu'on récupère la "vraie" valeur cachée
                    raw += el.dataset.raw;
                } else {
                    el.childNodes.forEach(traverse);
                }
            }
        };

        root.childNodes.forEach(traverse);
        return raw;
    };


    // --- 2. Gestion du Curseur (Caret) ---
    // Indispensable car changer innerHTML fait sauter le curseur au début

    const saveCaretPosition = (el: HTMLElement) => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return null;
        const range = selection.getRangeAt(0);
        const preSelectionRange = range.cloneRange();
        preSelectionRange.selectNodeContents(el);
        preSelectionRange.setEnd(range.startContainer, range.startOffset);
        return preSelectionRange.toString().length;
    };

    const restoreCaretPosition = (el: HTMLElement, offset: number) => {
        const selection = window.getSelection();
        const range = document.createRange();
        let currentPos = 0;
        let found = false;

        const traverse = (node: Node) => {
            if (found) return;
            if (node.nodeType === Node.TEXT_NODE) {
                const len = node.textContent?.length || 0;
                if (currentPos + len >= offset) {
                    range.setStart(node, offset - currentPos);
                    range.collapse(true);
                    found = true;
                }
                currentPos += len;
            } else {
                // Pour les éléments non-textuels (comme nos mentions contentEditable=false)
                // On les compte comme "longueur du texte visible" pour le positionnement relatif
                if(node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).dataset.type === "mention") {
                    // Longueur du contenu visuel (@Name)
                    const len = node.textContent?.length || 0;
                    if (currentPos + len >= offset) {
                         // Si on doit placer le curseur DANS la mention (impossible car false), on le met après
                         range.setStartAfter(node);
                         range.collapse(true);
                         found = true;
                    }
                    currentPos += len;
                } else {
                    // BR ou div wrapper
                    if(node.nodeName === "BR") currentPos += 1;
                    node.childNodes.forEach(traverse);
                }
            }
        };

        traverse(el);
        if (found && selection) {
            selection.removeAllRanges();
            selection.addRange(range);
        }
    };


    // --- 3. Synchronisation Value -> DOM ---

    useLayoutEffect(() => {
      // Si on est en train de taper (locked), on ne touche pas au DOM pour éviter les sauts
      // Sauf si la valeur externe a changé radicalement (reset form par exemple)
      if (editorRef.current) {
        const currentRaw = domToRaw(editorRef.current);
        if (value !== currentRaw) {
           // Sauvegarde curseur approximatif
           // const savedPos = saveCaretPosition(editorRef.current);
           editorRef.current.innerHTML = rawToHtml(value);
           // restoreCaretPosition(editorRef.current, savedPos || value.length);
        }
      }
    }, [value]);

    // Exposer la ref
    useLayoutEffect(() => {
      if (typeof ref === "function") ref(editorRef.current);
      else if (ref) ref.current = editorRef.current;
    }, [ref]);


    // --- 4. Handlers d'événements ---

    const handleInput = () => {
        if (!editorRef.current) return;
        isLockedRef.current = true;
        const newRaw = domToRaw(editorRef.current);
        onChange(newRaw);
        isLockedRef.current = false;
    };

    /**
     * C'est ici que se joue la logique "Backspace -> @"
     */
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Backspace") {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;

            const range = selection.getRangeAt(0);
            
            // Cas 1: Le curseur est juste APRÈS une mention
            // node précédent le curseur
            let prevNode = range.startContainer.childNodes[range.startOffset - 1] as HTMLElement;
            
            // Parfois le curseur est dans un noeud texte vide juste après le span
            if (!prevNode && range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset === 0) {
                 prevNode = range.startContainer.previousSibling as HTMLElement;
            }

            if (prevNode && prevNode.nodeType === Node.ELEMENT_NODE && prevNode.dataset.type === "mention") {
                e.preventDefault(); // On empêche la suppression totale du bloc

                // On crée un noeud texte simple "@"
                const atNode = document.createTextNode("@");
                
                // On remplace le span mention par le texte "@"
                prevNode.parentNode?.replaceChild(atNode, prevNode);

                // On place le curseur après le "@"
                const newRange = document.createRange();
                newRange.setStartAfter(atNode);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);

                // On déclenche la mise à jour
                handleInput();
            }
        }
    };

    return (
      <div
        className={cn(
          "relative w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
        style={{ minHeight }}
        onClick={() => editorRef.current?.focus()}
      >
        {/* Placeholder Hack */}
        {!value && (
          <div className="pointer-events-none absolute top-2 left-3 text-muted-foreground opacity-70">
            {placeholder}
          </div>
        )}

        <div
          ref={editorRef}
          contentEditable={!disabled}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          className="h-full w-full min-h-[inherit] outline-none whitespace-pre-wrap break-words overflow-y-auto"
          role="textbox"
          aria-multiline="true"
          {...props}
        />
      </div>
    );
  }
);

LinkifyTextarea.displayName = "LinkifyTextarea";