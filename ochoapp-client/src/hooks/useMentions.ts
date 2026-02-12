import { useCallback, useState, useEffect } from "react";
import { MentionedUser } from "@/lib/types";

export const MENTION_PATTERN = /@\[([^\]]+)\]\(([^)]+)\)/g;
export const MENTION_AT_PATTERN = /@/;

interface MentionState {
  isActive: boolean;
  searchQuery: string;
  position: { top: number; left: number };
  cursorPosition: number;
}

export function useMentions() {
  const [mentionState, setMentionState] = useState<MentionState>({
    isActive: false,
    searchQuery: "",
    position: { top: 0, left: 0 },
    cursorPosition: 0,
  });
  const [mentionedUsers, setMentionedUsers] = useState<MentionedUser[]>([]);

  // Detect @ symbol in text and extract search query
  const detectMentionStart = useCallback(
    (
      text: string,
      cursorPos: number,
      textareaElement?: HTMLTextAreaElement
    ) => {
      // Find the @ symbol before cursor
      const textBeforeCursor = text.substring(0, cursorPos);
      const lastAtIndex = textBeforeCursor.lastIndexOf("@");

      if (lastAtIndex === -1) {
        setMentionState((prev) => ({ ...prev, isActive: false }));
        return;
      }

      // Check if @ is preceded by a space or is at the start
      const isValidStart =
        lastAtIndex === 0 || /\s/.test(text[lastAtIndex - 1]);

      if (!isValidStart) {
        setMentionState((prev) => ({ ...prev, isActive: false }));
        return;
      }

      // Extract search query between @ and cursor
      const searchQuery = text.substring(lastAtIndex + 1, cursorPos);

      // Stop search if user types space or special characters that indicate end of mention
      if (/[\s\n]/.test(searchQuery)) {
        setMentionState((prev) => ({ ...prev, isActive: false }));
        return;
      }

      // Calculate position for overlay
      let position = { top: 0, left: 0 };

      if (textareaElement) {
        const textareaRect = textareaElement.getBoundingClientRect();
        
        // Approximate position based on cursor
        const lineHeight = 24; // Approximate line height
        const charWidth = 8; // Approximate char width
        const lines = text.substring(0, cursorPos).split("\n");
        const currentLine = lines.length - 1;
        const charInLine = lines[currentLine].length;

        position = {
          top: textareaRect.top + currentLine * lineHeight + lineHeight + 10,
          left: textareaRect.left + charInLine * charWidth + 10,
        };
      }

      setMentionState({
        isActive: true,
        searchQuery,
        position,
        cursorPosition: lastAtIndex + 1,
      });
    },
    []
  );

  // Format mention as @[displayName](username)
  const formatMention = useCallback(
    (text: string, user: MentionedUser, cursorPos: number): string => {
      // Find the @ symbol
      const textBeforeCursor = text.substring(0, cursorPos);
      const lastAtIndex = textBeforeCursor.lastIndexOf("@");

      if (lastAtIndex === -1) return text;

      const beforeAt = text.substring(0, lastAtIndex);
      const afterCursor = text.substring(cursorPos);

      return `${beforeAt}@[${user.displayName}](${user.username}) ${afterCursor}`;
    },
    []
  );

  // Add mentioned user to list
  const addMentionedUser = useCallback((user: MentionedUser) => {
    setMentionedUsers((prev) => {
      // Avoid duplicates
      if (prev.some((u) => u.id === user.id)) {
        return prev;
      }
      return [...prev, user];
    });
  }, []);

  // Remove mentioned user
  const removeMentionedUser = useCallback((userId: string) => {
    setMentionedUsers((prev) => prev.filter((u) => u.id !== userId));
  }, []);

  // Extract mentioned users from formatted text
  const extractMentionsFromText = useCallback((text: string): MentionedUser[] => {
    const mentions: MentionedUser[] = [];
    let match;

    while ((match = MENTION_PATTERN.exec(text)) !== null) {
      mentions.push({
        id: "", // Will be filled when extracting from content
        displayName: match[1],
        username: match[2],
      });
    }

    return mentions;
  }, []);

  // Clear mention state
  const clearMentionState = useCallback(() => {
    setMentionState({
      isActive: false,
      searchQuery: "",
      position: { top: 0, left: 0 },
      cursorPosition: 0,
    });
    setMentionedUsers([]);
  }, []);

  return {
    mentionState,
    mentionedUsers,
    detectMentionStart,
    formatMention,
    addMentionedUser,
    removeMentionedUser,
    extractMentionsFromText,
    clearMentionState,
  };
}
