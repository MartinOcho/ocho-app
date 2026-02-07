import * as React from "react";

import { cn } from "@/lib/utils";
import { useToast } from "./use-toast";
import { useTranslation } from "@/context/LanguageContext";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minHeight?: number;
  triggerResize?: boolean; // Nouvelle prop pour déclencher manuellement l'ajustement
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    { minHeight = 40, className, maxLength, value, triggerResize, ...props },
    ref,
  ) => {
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const { toast } = useToast();

    const { t } = useTranslation();

    const { maxLenReached } = t()
    let fontSize;
    let lineHeight;

    const textarea = textareaRef.current;
    if (textarea) {
      fontSize = getComputedStyle(textarea).fontSize;
      lineHeight = getComputedStyle(textarea).lineHeight;
    }

    // Fonction pour ajuster la hauteur du textarea
    const adjustHeight = React.useCallback(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = "auto"; // Réinitialise temporairement la hauteur
        const newHeight = Math.max(textarea.scrollHeight, minHeight); // Calcule la nouvelle hauteur
        textarea.style.height = `${newHeight}px`; // Applique la nouvelle hauteur
      }
    }, [minHeight]);

    // Gère l'entrée de l'utilisateur
    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      adjustHeight();
      if (maxLength && e.target.value.trim().length >= maxLength) {
        toast({
          description: maxLenReached.replace("[len]", `${maxLength}`),
        });
      }
      if (props.onChange) {
        props.onChange(e); // Appelle le gestionnaire onChange fourni par l'utilisateur
      }
    };

    // Ajuste la hauteur lorsque `value`, `style.fontSize`, ou `triggerResize` change
    React.useEffect(() => {
      const frameId = requestAnimationFrame(adjustHeight);
      return () => cancelAnimationFrame(frameId);
    }, [value, triggerResize, adjustHeight, fontSize, lineHeight]);

    return (
      <textarea
        className={cn(
          "flex w-full resize-none overflow-hidden overflow-y-auto rounded-sm border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          `min-h-[${minHeight}px]`,
          className,
        )}
        ref={(node) => {
          textareaRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        value={value}
        onInput={handleInput}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";

export { Textarea };
