import React, { useRef, useEffect, useLayoutEffect, useState } from "react";
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

    // Synchronisation de la ref externe et interne
    useLayoutEffect(() => {
      if (typeof ref === "function") {
        ref(editorRef.current);
      } else if (ref) {
        ref.current = editorRef.current;
      }
    }, [ref]);

    // Fonction de coloration syntaxique "VS Code style"
    // On garde le texte brut mais on wrap les parties spéciales dans des spans
    const highlightSyntax = (text: string) => {
      if (!text) return '<br class="ProseMirror-trailingBreak">'; // Hack pour le placeholder

      let html = text
        // Sécurité XSS basique (remplace < et >)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      // 1. Highlight Mentions: @[Display](id)
      // On met le Display en évidence, et on grise les crochets et l'ID
      html = html.replace(
        /@\[([^\]]+)\]\(([^)]+)\)/g,
        (match, name, id) => {
          return `<span class="inline-block bg-primary/10 rounded-sm text-primary mx-0.5">
            <span class="opacity-40 text-xs">@[</span>
            <span class="font-semibold">${name}</span>
            <span class="opacity-40 text-xs">](${id})</span>
          </span>`;
        }
      );

      // 2. Highlight Hashtags: #tag
      html = html.replace(
        /(?<!\w)#(\w+)/g,
        '<span class="text-blue-500 font-medium">#$1</span>'
      );

      // 3. Highlight URLs
      html = html.replace(
        /(https?:\/\/[^\s]+)/g,
        '<span class="text-blue-500 underline decoration-blue-500/30">$1</span>'
      );
      
      // Remplace les sauts de ligne par des br pour l'affichage HTML
      return html.replace(/\n/g, "<br/>");
    };

    // Synchronisation Value -> HTML
    // On ne met à jour le HTML que si la valeur a changé "de l'extérieur" pour ne pas casser le curseur
    useLayoutEffect(() => {
      if (editorRef.current && editorRef.current.innerText !== value) {
        // Sauvegarde simple de la position (si focus) - imparfait pour modification complexe externe mais ok pour reset
        editorRef.current.innerHTML = highlightSyntax(value);
      }
    }, [value]);

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
      const text = e.currentTarget.innerText;
      // On envoie le texte brut au parent
      onChange(text);
    };
    const handleBlur = () => {
        setIsFocused(false);
        if (editorRef.current) {
            editorRef.current.innerHTML = highlightSyntax(value);
        }
    };

    return (
      <div className={cn("relative w-full group", className)}>
        {/* Placeholder simulé */}
        {!value && (
          <div className="absolute top-3 left-3 text-muted-foreground pointer-events-none select-none text-sm">
            {placeholder}
          </div>
        )}

        <div
          ref={editorRef}
          contentEditable={!disabled}
          onInput={handleInput}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          className={cn(
            "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "whitespace-pre-wrap break-words overflow-y-auto",
            "empty:before:content-['\\200b']", // Fix height collapse
            disabled && "cursor-not-allowed opacity-50"
          )}
          style={{ 
            minHeight: minHeight,
            maxHeight: "300px",
            outline: "none" // On gère le ring via Tailwind
          }}
          role="textbox"
          aria-multiline="true"
          {...props}
        />
        
        {/* Indicateur visuel pour l'utilisateur */}
        <div className="absolute bottom-1 right-2 text-[10px] text-muted-foreground opacity-50 pointer-events-none">
            {isFocused ? "Mode Édition" : "Mode Visuel"}
        </div>
      </div>
    );
  }
);

LinkifyTextarea.displayName = "LinkifyTextarea";