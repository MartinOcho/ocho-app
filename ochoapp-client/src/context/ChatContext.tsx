"use client"

import { useSession } from "@/app/(main)/SessionProvider";
import { createContext, useContext, useEffect, useState } from "react";

interface ChatContextType {
  activeRoomId: string | null;
  setActiveRoomId: (id: string | null) => void;
  isMediaFullscreen: boolean;
  setIsMediaFullscreen: (fullscreen: boolean) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(
  undefined,
);

export const useActiveRoom = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error(
      "useActiveRoom must be used within an ChatProvider",
    );
  }
  return context;
};

export const ChatProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const {user} = useSession();
  const userId = user.id
  const [activeRoomId, setActiveRoomId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(userId) || null;
    }
    return null;
  });
  const [isMediaFullscreen, setIsMediaFullscreen] = useState(false);

  useEffect(() => {
    // Mettre à jour sessionStorage lorsque activeRoomId change
    activeRoomId
      ? sessionStorage.setItem(userId, activeRoomId)
      : sessionStorage.removeItem(userId);
  }, [activeRoomId, userId]);

  return (
    <ChatContext.Provider value={{ activeRoomId, setActiveRoomId, isMediaFullscreen, setIsMediaFullscreen }}>
      {children}
    </ChatContext.Provider>
  );
};
