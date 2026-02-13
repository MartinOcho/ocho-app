import React, { useRef, useLayoutEffect, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

interface LinkifyTextareaProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
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

    // --- 1. CONVERSION DATA -> HTML (Pour l'affichage) ---
    const rawToHtml = useCallback((text: string) => {
      if (!text) return '<br class="ProseMirror-trailingBreak">'; 

      let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      // Transformation des Mentions : @[Display](id) -> HTML Span
      // Note: contentEditable="false" rend l'élément "atomique" (on ne peut pas éditer l'intérieur)
      html = html.replace(
        /@\[([^\]]+)\]\(([^)]+)\)/g,
        (match, name, id) => {
          return `<span data-mention-id="${id}" data-mention-name="${name}" contenteditable="false" class="mention-node inline-block bg-primary/10 rounded-sm text-primary px-0.5 mx-0.5 font-semibold select-none cursor-pointer hover:bg-primary/20 transition-colors">@${name}</span>`;
        }
      );

      // Hashtags (Simple styling)
      html = html.replace(
        /(?<!\w)#(\w+)/g,
        '<span class="text-blue-500 font-medium">#$1</span>'
      );

      // URLs
      html = html.replace(
        /(https?:\/\/[^\s]+)/g,
        '<span class="text-blue-500 underline decoration-blue-500/30">$1</span>'
      );
      
      return html.replace(/\n/g, "<br/>");
    }, []);

    // --- 2. CONVERSION HTML -> DATA (Pour le onChange) ---
    const htmlToRaw = useCallback((container: HTMLElement) => {
        let raw = "";
        
        const traverse = (node: Node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                raw += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                
                // Si c'est une mention (détectée via dataset)
                if (el.dataset.mentionId) {
                    raw += `@[${el.dataset.mentionName}](${el.dataset.mentionId})`;
                    return; // On n'entre pas dans les enfants de la mention
                }

                if (el.tagName === "BR") {
                    raw += "\n";
                } else if (el.tagName === "DIV" && raw.length > 0) {
                    // Les div sont souvent utilisés par les navigateurs pour les nouvelles lignes
                    raw += "\n"; 
                    el.childNodes.forEach(traverse);
                } else {
                    el.childNodes.forEach(traverse);
                }
            }
        };

        container.childNodes.forEach(traverse);
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

    // Quand la prop `value` change depuis l'extérieur (ex: chargement initial ou reset)
    // On ne met à jour le HTML que si on n'est pas en train de taper pour éviter de faire sauter le curseur
    useEffect(() => {
        if (!editorRef.current) return;
        
        // On compare la valeur actuelle générée depuis le HTML avec la nouvelle value
        const currentRaw = htmlToRaw(editorRef.current);
        
        if (currentRaw !== value && !isTypingRef.current) {
             editorRef.current.innerHTML = rawToHtml(value);
        }
        // Si c'est juste un changement de formatage mais même contenu textuel, on peut ignorer
        // ou gérer plus finement, mais ici on priorise la stabilité du curseur.
    }, [value, htmlToRaw, rawToHtml]);


    // --- 4. GESTIONNAIRES D'ÉVÉNEMENTS ---

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
      isTypingRef.current = true;
      const newRawValue = htmlToRaw(e.currentTarget);
      onChange(newRawValue);
      
      // Petit hack pour reset le flag de typing après un court délai
      // Cela permet aux mises à jour externes de reprendre si l'utilisateur s'arrête
      setTimeout(() => {
          isTypingRef.current = false;
      }, 100);
    };

    // LOGIQUE SPÉCIALE BACKSPACE
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Backspace') {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;
            
            const range = selection.getRangeAt(0);

            // On cherche si on est JUSTE APRÈS une mention
            let prevNode: Node | null = null;

            // Cas 1 : Le curseur est au début d'un noeud texte, il faut regarder le noeud précédent dans le DOM
            if (range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset === 0) {
                prevNode = range.startContainer.previousSibling;
            } 
            // Cas 2 : Le curseur est dans l'élément parent, on regarde l'enfant à l'index offset-1
            else if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
                const childNodes = range.startContainer.childNodes;
                if (range.startOffset > 0) {
                    prevNode = childNodes[range.startOffset - 1];
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
                    newRange.setEndAfter(atTextNode);
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
        // Optionnel : Re-formater proprement au blur pour être sûr que tout est clean
        if (editorRef.current) {
            // Attention : ceci peut faire sauter la sélection si on re-focus immédiatement
            // editorRef.current.innerHTML = rawToHtml(value); 
        }
    };

    return (
      <div className={cn(
          "relative flex w-full resize-none overflow-hidden overflow-y-auto rounded-sm border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          `min-h-[${minHeight}px]`,
          className,
        )}>
        
        {/* Placeholder simulé (affiché seulement si raw value est vide) */}
        {!value && (
          <div className="absolute inset-0 py-2 text-muted-foreground pointer-events-none select-none text-sm z-0">
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