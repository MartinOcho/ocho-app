"use client";

import { useEffect, useState, useRef } from "react";
import { MentionedUser } from "@/lib/types";
import UserAvatar from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import { RoomData } from "@/lib/types";

export interface MentionOverlayProps {
  visible: boolean;
  searchQuery: string;
  position: { top: number; left: number };
  roomMembers: RoomData["members"];
  onSelectMention: (user: MentionedUser) => void;
  currentUserId?: string;
}

export default function MentionOverlay({
  visible,
  searchQuery,
  position,
  roomMembers,
  onSelectMention,
  currentUserId,
}: MentionOverlayProps) {
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [filteredUsers, setFilteredUsers] = useState<MentionedUser[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Filter users based on search query
  useEffect(() => {
    let filtered: MentionedUser[];
    
    if (!searchQuery.trim()) {
      // Si la recherche est vide (juste après le @), montrer tous les membres
      filtered = roomMembers
        .filter((member) => {
          if (currentUserId && member.userId === currentUserId) {
            return false;
          }
          return member.user !== undefined;
        })
        .map((member) => ({
          id: member.user?.id || "",
          username: member.user?.username || "",
          displayName: member.user?.displayName || "",
          avatarUrl: member.user?.avatarUrl || "",
        }))
        .slice(0, 8);
    } else {
      // Filtrer par la requête de recherche
      const query = searchQuery.toLowerCase();
      filtered = roomMembers
        .filter((member) => {
          // Don't suggest the current user
          if (currentUserId && member.userId === currentUserId) {
            return false;
          }
          if (!member.user) return false;
          return (
            member.user.displayName.toLowerCase().includes(query) ||
            member.user.username.toLowerCase().includes(query)
          );
        })
        .sort((a, b) => {
          if(!a.user || !b.user) return 0;
          const aUsernameMatch = a.user.username.toLowerCase().startsWith(query);
          const bUsernameMatch = b.user.username.toLowerCase().startsWith(query);
          if (aUsernameMatch !== bUsernameMatch) return bUsernameMatch ? 1 : -1;
          
          // Then sort by displayName match
          const aDisplayMatch = a.user.displayName.toLowerCase().startsWith(query);
          const bDisplayMatch = b.user.displayName.toLowerCase().startsWith(query);
          return bDisplayMatch ? 1 : -1;
        })
        .slice(0, 8) // Limit to 8 suggestions
        .map((member) => ({
          id: member.user?.id || "",
          username: member.user?.username || "",
          displayName: member.user?.displayName || "",
          avatarUrl: member.user?.avatarUrl || "",
        }));
    }

    setFilteredUsers(filtered);
    setHighlightedIndex(0);
  }, [searchQuery, roomMembers, currentUserId]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!visible || filteredUsers.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredUsers.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredUsers[highlightedIndex]) {
          onSelectMention(filteredUsers[highlightedIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, filteredUsers, highlightedIndex, onSelectMention]);

  if (!visible || filteredUsers.length === 0) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      className="fixed z-50 rounded-lg border border-border bg-background shadow-lg"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        maxWidth: "300px",
        maxHeight: "300px",
        overflowY: "auto",
      }}
    >
      {filteredUsers.map((user, index) => (
        <div
          key={user.id}
          className={cn(
            "flex items-center gap-3 border-b border-border px-4 py-3 cursor-pointer transition-colors",
            index === highlightedIndex
              ? "bg-primary/10"
              : "hover:bg-secondary/50"
          )}
          onClick={() => onSelectMention(user)}
        >
          <UserAvatar
            userId={user.id}
            avatarUrl={user.avatarUrl}
            className="h-8 w-8"
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate text-sm">{user.displayName}</p>
            <p className="text-xs text-muted-foreground">@{user.username}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
