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
          return `<span class="inline-block bg-primary/10 rounded-sm text-primary whitespace-pre-wrap font-semibold">@${name}</span>`;
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

    useLayoutEffect(() => {
      if (editorRef.current && editorRef.current.innerText !== value) {
        editorRef.current.innerHTML = highlightSyntax(value);
      }
    }, [value]);

    const adjustHeight = React.useCallback(() => {
      const textarea = editorRef.current;
      if (textarea) {
        textarea.style.height = "auto"; // Réinitialise temporairement la hauteur
        const newHeight = Math.max(textarea.scrollHeight, minHeight); // Calcule la nouvelle hauteur
        textarea.style.height = `${newHeight}px`; // Applique la nouvelle hauteur
      }
    }, [minHeight]);

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
      <div className={cn(
          "relative flex w-full resize-none overflow-hidden overflow-y-auto rounded-sm border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          `min-h-[${minHeight}px]`,
          className,
        )}>
        {/* Placeholder simulé */}
        {!value && (
          <div className="absolute inset-0 text-muted-foreground pointer-events-none select-none text-sm">
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
            "outline-none whitespace-pre-wrap break-words w-full h-full min-h-full min-w-full cursor-text overflow-hidden overflow-y-auto",
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