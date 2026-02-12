"use client";

import React, { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface LinkifyTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

type Token =
  | { type: "text"; value: string }
  | { type: "mention"; name: string; id: string };

function parseTokens(text: string): Token[] {
  const regex = /@\[(.*?)\]\((.*?)\)/g;

  const tokens: Token[] = [];

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text))) {
    if (match.index > lastIndex) {
      tokens.push({
        type: "text",
        value: text.slice(lastIndex, match.index),
      });
    }

    tokens.push({
      type: "mention",
      name: match[1],
      id: match[2],
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({
      type: "text",
      value: text.slice(lastIndex),
    });
  }

  return tokens;
}

export const LinkifyTextarea = React.forwardRef<
  HTMLDivElement,
  LinkifyTextareaProps
>(function LinkifyTextarea(
  { value, onChange, placeholder, className, disabled, onKeyDown },
  ref
) {
  const editorRef = useRef<HTMLDivElement>(null);

  // expose ref
  useEffect(() => {
    if (!ref) return;
    if (typeof ref === "function") ref(editorRef.current);
    else ref.current = editorRef.current;
  }, [ref]);

  // render tokens only when external value changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (editor.dataset.lastValue === value) return;

    editor.innerHTML = "";

    const tokens = parseTokens(value);

    tokens.forEach((token) => {
      if (token.type === "text") {
        editor.appendChild(document.createTextNode(token.value));
      } else {
        const span = document.createElement("span");

        span.textContent = `@${token.name}`;
        span.contentEditable = "false";

        span.dataset.mention = token.id;
        span.dataset.name = token.name;

        span.className =
          "inline-block rounded bg-primary/10 text-primary px-1";

        editor.appendChild(span);
      }
    });

    editor.dataset.lastValue = value;
  }, [value]);

  // serialize DOM → raw value
  const serialize = () => {
    const editor = editorRef.current;
    if (!editor) return "";

    let result = "";

    editor.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent;
      } else {
        const el = node as HTMLElement;

        if (el.dataset.mention) {
          result += `@[${el.dataset.name}](${el.dataset.mention})`;
        }
      }
    });

    return result;
  };

  const handleInput = () => {
    const raw = serialize();
    onChange(raw);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.key !== "Backspace") return;

    const sel = window.getSelection();
    if (!sel || !sel.anchorNode) return;

    const node = sel.anchorNode;

    const parent =
      node.nodeType === 3 ? node.parentElement : (node as HTMLElement);

    if (parent?.dataset?.mention) {
      e.preventDefault();

      parent.replaceWith(document.createTextNode("@"));

      handleInput();
    }
  };

  return (
    <div className="relative">
      {!value && placeholder && (
        <div className="absolute left-3 top-2 pointer-events-none text-muted-foreground">
          {placeholder}
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        className={cn(
          "min-h-[40px] w-full rounded border border-input px-3 py-2 outline-none whitespace-pre-wrap break-words",
          className
        )}
        role="textbox"
      />
    </div>
  );
});
