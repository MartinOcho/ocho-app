"use client";

import { useEffect, useRef, useState, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { LinkIt, LinkItUrl } from "react-linkify-it";
import { AtSign } from "lucide-react";

interface EditableTextAreaProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Un composant qui simule un textarea mais affiche le contenu linkifié
 * Utilise contenteditable et affiche les mentions, URLs, hashtags en temps réel
 */
export const EditableTextArea = forwardRef<HTMLDivElement, EditableTextAreaProps>(
  (
    {
      value,
      onChange,
      onKeyDown,
      placeholder,
      className,
      disabled = false,
    },
    ref
  ) => {
    const internalRef = useRef<HTMLDivElement>(null);
    const editorRef = ref || internalRef;
    const [isUpdatingFromProp, setIsUpdatingFromProp] = useState(false);

    // Reconstruct the DOM to show linkified content while preserving cursor
    useEffect(() => {
      if (!(editorRef as React.MutableRefObject<HTMLDivElement>).current || isUpdatingFromProp) return;

      const current = (editorRef as React.MutableRefObject<HTMLDivElement>).current;

      // Get current selection before modifying DOM
      const selection = window.getSelection();
      let cursorOffset = 0;
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(current);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        cursorOffset = preCaretRange.toString().length;
      }

      setIsUpdatingFromProp(true);

      // Clear the editor
      current.innerHTML = "";

      if (!value.trim()) {
        current.textContent = "";
        setIsUpdatingFromProp(false);
        return;
      }

      // Parse and render linkified content
      renderLinkifiedContent(current, value);

      // Restore cursor position
      setTimeout(() => {
        restoreCursorPosition(current, cursorOffset);
        setIsUpdatingFromProp(false);
      }, 0);
    }, [value, isUpdatingFromProp, editorRef]);

    const handleInput = () => {
      const current = (editorRef as React.MutableRefObject<HTMLDivElement | null>).current;
      if (current) {
        // Extract plain text from the contenteditable
        const text = extractPlainText(current);
        onChange(text);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(e);
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      // Prevent interaction with links inside - we want to edit the text
      if ((e.target as HTMLElement).tagName === "A") {
        e.preventDefault();
      }
    };

    return (
      <div className="relative w-full">
        {/* Editable container with linkified content */}
        <div
          ref={editorRef}
          contentEditable={!disabled}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onMouseDown={handleMouseDown}
          suppressContentEditableWarning
          className={cn(
            "min-h-10 max-h-[10rem] w-full overflow-y-auto rounded-none border-none bg-transparent py-2 px-0.5 outline-none ring-0 focus:ring-0",
            "whitespace-pre-wrap break-words prose prose-sm max-w-none",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
          style={{
            wordWrap: "break-word",
            overflowWrap: "break-word",
          }}
        />

        {/* Placeholder */}
        {!value.length && (
          <div className="pointer-events-none text-muted-foreground py-2 px-0.5">
            {placeholder}
          </div>
        )}
      </div>
    );
  }
);

EditableTextArea.displayName = "EditableTextArea";

/**
 * Extract plain text from contenteditable div
 */
function extractPlainText(element: HTMLElement): string {
  let text = "";
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === "BR") {
        text += "\n";
      } else {
        text += el.textContent;
      }
    }
  }
  return text;
}

/**
 * Render linkified content into the editor
 */
function renderLinkifiedContent(container: HTMLElement, text: string) {
  // Regular expressions for different link types
  const mentionPattern = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const hashtagPattern = /#([a-zA-Z0-9_-]+)/g;
  const usernamePattern = /(?<!https?:\/\/\S*)(?<!@\[)@([a-zA-Z0-9_-]+)(?!\])/g;

  let lastIndex = 0;
  const fragments: (string | { type: string; content: string })[] = [];

  // Parse mentions first
  let match: RegExpExecArray | null;
  const mentionMatches: Array<{ start: number; end: number; type: "mention"; display: string; username: string }> = [];
  const regexMention = /@\[([^\]]+)\]\(([^)]+)\)/g;
  while ((match = regexMention.exec(text)) !== null) {
    mentionMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      type: "mention",
      display: match[1],
      username: match[2],
    });
  }

  // Parse URLs
  const urlMatches: Array<{ start: number; end: number; type: "url"; url: string }> = [];
  const regexUrl = /(https?:\/\/[^\s]+)/g;
  while ((match = regexUrl.exec(text)) !== null) {
    urlMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      type: "url",
      url: match[0],
    });
  }

  // Parse hashtags
  const hashtagMatches: Array<{ start: number; end: number; type: "hashtag"; tag: string }> = [];
  const regexHashtag = /#([a-zA-Z0-9_-]+)/g;
  while ((match = regexHashtag.exec(text)) !== null) {
    hashtagMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      type: "hashtag",
      tag: match[1],
    });
  }

  // Parse usernames (but exclude those in mentions)
  const usernameMatches: Array<{ start: number; end: number; type: "username"; username: string }> = [];
  const regexUsername = /(?<!https?:\/\/\S*)(?<!@\[)@([a-zA-Z0-9_-]+)(?!\])/g;
  while ((match = regexUsername.exec(text)) !== null) {
    // Skip if this is part of a mention
    if (!mentionMatches.some((m) => m.start <= match!.index && match!.index < m.end)) {
      usernameMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        type: "username",
        username: match[1],
      });
    }
  }

  // Combine all matches and sort by position
  const allMatches = [...mentionMatches, ...urlMatches, ...hashtagMatches, ...usernameMatches].sort(
    (a, b) => a.start - b.start
  );

  // Build the content with fragments
  let currentPos = 0;
  for (const m of allMatches) {
    // Add plain text before this match
    if (currentPos < m.start) {
      container.appendChild(document.createTextNode(text.substring(currentPos, m.start)));
    }

    // Add the styled element
    const span = document.createElement("span");
    if (m.type === "mention") {
      span.innerHTML = `<span class="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 bg-primary/10 text-primary">
        @${m.display}
      </span>`;
    } else if (m.type === "url") {
      span.innerHTML = `<a href="${m.url}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline cursor-pointer">${m.url}</a>`;
    } else if (m.type === "hashtag") {
      span.innerHTML = `<a href="/hashtag/${m.tag}" class="text-primary hover:underline">#${m.tag}</a>`;
    } else if (m.type === "username") {
      span.innerHTML = `<a href="/user/${m.username}" class="text-primary hover:underline">@${m.username}</a>`;
    }
    container.appendChild(span);

    currentPos = m.end;
  }

  // Add remaining text
  if (currentPos < text.length) {
    container.appendChild(document.createTextNode(text.substring(currentPos)));
  }
}

/**
 * Restore cursor position after DOM reconstruction
 */
function restoreCursorPosition(container: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) return;

  let currentOffset = 0;
  for (const node of container.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const nodeLength = node.textContent?.length ?? 0;
      if (currentOffset + nodeLength >= offset) {
        const range = document.createRange();
        range.setStart(node, Math.min(offset - currentOffset, nodeLength));
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      currentOffset += nodeLength;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const nodeLength = (node as HTMLElement).textContent?.length ?? 0;
      if (currentOffset + nodeLength >= offset) {
        // Try to position in a text node inside
        const textNodes = getAllTextNodes(node as HTMLElement);
        for (const textNode of textNodes) {
          const textLength = textNode.textContent?.length ?? 0;
          if (currentOffset + textLength >= offset) {
            const range = document.createRange();
            range.setStart(textNode, Math.min(offset - currentOffset, textLength));
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            return;
          }
          currentOffset += textLength;
        }
      }
      currentOffset += nodeLength;
    }
  }
}

/**
 * Get all text nodes from an element
 */
function getAllTextNodes(element: HTMLElement): Text[] {
  const textNodes: Text[] = [];
  const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
  let node;
  while ((node = walk.nextNode())) {
    textNodes.push(node as Text);
  }
  return textNodes;
}
