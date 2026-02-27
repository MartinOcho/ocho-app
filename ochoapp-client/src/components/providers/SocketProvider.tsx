"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "@/app/(main)/SessionProvider";
import { toast } from "../ui/use-toast";
import { Loader2, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import kyInstance from "@/lib/ky";
import { MessageData, NotificationData, RoomData } from "@/lib/types";
import { useTranslation } from "@/context/LanguageContext";

// Définition des types pour le contexte
interface PendingMessage {
  newMessage: MessageData;
  roomId: string;
  tempId?: string;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  onlineStatus: Record<string, { isOnline: boolean; lastSeen?: Date }>;
  checkUserStatus: (userId: string) => void;
  retryConnection: () => void;
  notificationsUnread?: number | null;
  messagesUnread?: number | null;
  getPendingMessages: (roomId: string) => PendingMessage[];
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  isConnecting: false,
  onlineStatus: {},
  checkUserStatus: () => {},
  retryConnection: () => {},
  notificationsUnread: null,
  messagesUnread: null,
  getPendingMessages: () => [],
});

// Hook personnalisé pour utiliser le socket
export const useSocket = (userId?: string) => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }

  useEffect(() => {
    // Si on surveille un userId spécifique et qu'on est connecté, on demande son statut
    if (userId && context.isConnected) {
      context.checkUserStatus(userId);
    }
  }, [userId, context.isConnected, context.checkUserStatus]);

  if (userId) {
    return {
      ...context,
      userStatus: context.onlineStatus[userId] || null,
    };
  }
  return context;
};

export default function SocketProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { user, token } = useSession();

  // Ref pour stocker l'instance du socket
  const socketRef = useRef<Socket | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState<
    Record<string, { isOnline: boolean; lastSeen?: Date }>
  >({});
  const [isServerTriggered, setIsServerTriggered] = useState(false);
  const [forceReconnect, setForceReconnect] = useState(0);
  const [notificationsUnread, setNotificationsUnread] = useState<number | null>(null);
  const [messagesUnread, setMessagesUnread] = useState<number | null>(null);
  // État pour stocker les messages en attente par room
  // Structure: { roomId: [{ newMessage, roomId, tempId?, timestamp }], ... }
  const [pendingMessages, setPendingMessages] = useState<Record<string, PendingMessage[]>>({});

  // Fonction stable pour émettre des événements
  const checkUserStatus = useCallback((targetUserId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("check_user_status", { userId: targetUserId });
    }
  }, []);

  // Ref pour stocker les messages en attente (évite les re-renders)
  const pendingMessagesRef = useRef<Record<string, PendingMessage[]>>(pendingMessages);

  useEffect(() => {
    pendingMessagesRef.current = pendingMessages;
  }, [pendingMessages]);

  // Fonction pour récupérer les messages en attente pour une room
  const getPendingMessages = useCallback((roomId: string): PendingMessage[] => {
    const messages = pendingMessagesRef.current[roomId] || [];
    // Nettoyer les messages de cette room immédiatement après les avoir récupérés
    setPendingMessages((prev) => {
      const updated = { ...prev };
      delete updated[roomId];
      return updated;
    });
    return messages;
  }, []);

  // Fonction pour forcer une reconnexion manuelle
  const retryConnection = useCallback(() => {
    console.log("🔄 Tentative de reconnexion manuelle...");
    setForceReconnect((prev) => prev + 1);
  }, []);

  useEffect(() => {
    // 1. Protection basique : pas d'utilisateur ou pas de token = pas de socket
    if (!user || !token) {
      if (socketRef.current) {
        console.log("🛑 Déconnexion (Logout ou pas de token)");
        socketRef.current.removeAllListeners(); // Important : supprime les écouteurs avant de couper
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Drapeau pour empêcher les actions "zombies" lors du démontage
    let isComponentUnmounted = false;

    setIsConnecting(true);
    setShowStatus(true);
    const socketInstance = io(
      process.env.NEXT_PUBLIC_CHAT_SERVER_URL || "http://localhost:5000",
      {
        auth: { token: token },
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        transports: ["websocket", "polling"],
        closeOnBeforeunload: true,
        timeout: 5000,
      },
    );

    socketRef.current = socketInstance;

    // 4. Gestionnaires d'événements

    const onConnect = () => {
      if (isComponentUnmounted) return; // Sécurité : ne pas mettre à jour l'état si démonté
      console.log("🟢 WS Connecté :", socketInstance.id);
      setIsConnected(true);
      setIsConnecting(false);

      // Charger l'état initial des notifications et messages non lus
      Promise.all([
        kyInstance
          .get("/api/notifications/unread-count")
          .json<{ unreadCount: number }>()
          .then((d) => {
            if (!isComponentUnmounted && typeof d?.unreadCount === "number") {
              setNotificationsUnread(d.unreadCount);
            }
          })
          .catch(() => {}),
        kyInstance
          .get("/api/messages/unread-count")
          .json<{ unreadCount: number }>()
          .then((d) => {
            if (!isComponentUnmounted && typeof d?.unreadCount === "number") {
              setMessagesUnread(d.unreadCount);
            }
          })
          .catch(() => {}),
      ]);

      // On masque le toast de statut après un délai
      setTimeout(() => {
        if (!isComponentUnmounted) setShowStatus(false);
      }, 3000);
    };

    const onDisconnect = (reason: string) => {
      if (isComponentUnmounted) return; // CRUCIAL : Ne rien faire si le composant est en train de se détruire

      console.log("🔴 WS Déconnecté. Raison:", reason);
      setIsConnected(false);

      const isServerDisconnect = reason === "io server disconnect";
      const isTransportError = reason === "transport close";

      if (isServerDisconnect || isTransportError) {
        setShowStatus(true);
        setIsConnecting(true);
      }
    };

    let errors = 0;

    const onConnectError = () => {
      errors++;
      if (errors >= 5) {
        socketInstance.disconnect();
        setIsConnecting(false);
        setShowStatus(true);
      }
    };

    // Événements Métiers
    
    // Listener global pour les messages (stocke en attente si le composant Chat n'est pas encore monté)
    const onReceiveMessage = (data: {
      newMessage: MessageData;
      roomId: string;
      tempId?: string;
    }) => {
      if (isComponentUnmounted) return;
      console.log("📨 Message reçu (stocké en attente) pour room:", data.roomId);
      setPendingMessages((prev) => ({
        ...prev,
        [data.roomId]: [...(prev[data.roomId] || []), data],
      }));
    };

    const onUserStatusChange = (data: {
      userId: string;
      isOnline: boolean;
      lastSeen?: string;
    }) => {
      if (isComponentUnmounted) return;
      setOnlineStatus((prev) => ({
        ...prev,
        [data.userId]: {
          isOnline: data.isOnline,
          lastSeen: data.lastSeen ? new Date(data.lastSeen) : undefined,
        },
      }));
    };

    const onNewRoomCreated = (room: RoomData) => {
      if (isComponentUnmounted) return;
      console.log("📩 Nouvelle discussion :", room);
      socketInstance.emit("join_room", room.id);
      toast({ description: t().youAreAddedToANewRoom });
    };

    const onNotificationsUnreadUpdate = (data: { unreadCount: number }) => {
      if (isComponentUnmounted) return;
      setNotificationsUnread(typeof data?.unreadCount === "number" ? data.unreadCount : null);
    };

    const onRoomsUnreadsUpdate = (data: { unreadCount: number }) => {
      if (isComponentUnmounted) return;
      setMessagesUnread(typeof data?.unreadCount === "number" ? data.unreadCount : null);
    };

    const onNotificationReceived = (notification: NotificationData) => {
      if (isComponentUnmounted) return;
      console.log("🔔 Notification reçue:", notification);
      
      // Afficher un toast selon le type de notification
      const typeMessages: Record<string, string> = {
        LIKE: t("likedYourPost"),
        COMMENT: `${t("commented")} ${notification.comment?.content ? `${t("commentPrev").replace("[c]", notification.comment.content.slice(0, 30))}` : t("onYourPost")}.`,
        COMMENT_LIKE: t("likedYourComment"),
        COMMENT_REPLY: `${t("replied")} ${notification.comment?.content ? `${t("commentPrev").replace("[c]", notification.comment.content.slice(0, 30))}` : t("onYourComment")}.`,
        FOLLOW: t("followedYou"),
        IDENTIFY: t("taggedYou"),
      };
      
      const message = notification.issuer?.displayName ? `${notification.issuer.displayName} ${typeMessages[notification.type]}` : typeMessages[notification.type];
      toast({ description: message });
    };

    const onNotificationDeleted = (data: any) => {
      if (isComponentUnmounted) return;
      console.log("🗑️ Notification supprimée:", data);
      // Invalider les notifications pour les mettre à jour
      // L'invalidation sera gérée par les listeners qui mettent à jour l'unreadCount
    };

    const onAllNotificationsMarkedAsRead = () => {
      if (isComponentUnmounted) return;
      console.log("✅ Toutes les notifications marquées comme lues");
      setNotificationsUnread(0);
    };

    // Événements Système (Reconnexion)
    const onReconnectAttempt = () => {
      if (isComponentUnmounted) return;
      console.log("🔄 Tentative de reconnexion auto...");
      setIsConnecting(true);
      setShowStatus(true);
    };

    const onReconnect = () => {
      if (isComponentUnmounted) return;
      console.log("✅ Reconnecté auto !");
      setIsConnected(true);
      setIsConnecting(false);
      setTimeout(() => {
        if (!isComponentUnmounted) setShowStatus(false);
      }, 3000);
    };

    // Attachement des ecouteurs
    socketInstance.on("connect", onConnect);
    socketInstance.on("disconnect", onDisconnect);
    socketInstance.on("connect_error", onConnectError);
    socketInstance.on("receive_message", onReceiveMessage);
    socketInstance.on("user_status_change", onUserStatusChange);
    socketInstance.on("new_room_created", onNewRoomCreated);
    socketInstance.on("notifications_unread_update", onNotificationsUnreadUpdate);
    socketInstance.on("notification_received", onNotificationReceived);
    socketInstance.on("notification_deleted", onNotificationDeleted);
    socketInstance.on("all_notifications_marked_as_read", onAllNotificationsMarkedAsRead);
    socketInstance.on("rooms_unreads_update", onRoomsUnreadsUpdate);

    // Écouteurs sur le manager (io)
    socketInstance.io.on("reconnect_attempt", onReconnectAttempt);
    socketInstance.io.on("reconnect", onReconnect);

    // 5. Nettoyage (CLEANUP)
    return () => {
      console.log(
        "🧹 Nettoyage complet du socket (ID:",
        socketInstance.id,
        ")",
      );

      // 1. On lève le drapeau pour bloquer toute logique dans les écouteurs ci-dessus
      isComponentUnmounted = true;

      // 2. Suppression de TOUS les ecouteurs pour eviter les fuites et les appels fantomes
      socketInstance.removeAllListeners();
      socketInstance.io.off("reconnect_attempt", onReconnectAttempt);
      socketInstance.io.off("reconnect", onReconnect);
      socketInstance.off("notifications_unread_update", onNotificationsUnreadUpdate);
      socketInstance.off("notification_received", onNotificationReceived);
      socketInstance.off("notification_deleted", onNotificationDeleted);
      socketInstance.off("all_notifications_marked_as_read", onAllNotificationsMarkedAsRead);
      socketInstance.off("rooms_unreads_update", onRoomsUnreadsUpdate);

      // 3. Déconnexion explicite
      socketInstance.disconnect();

      // 4. Mise à jour de la Ref
      if (socketRef.current === socketInstance) {
        socketRef.current = null;
      }
    };
  }, [user, token, forceReconnect]);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        isConnecting,
        onlineStatus,
        checkUserStatus,
        retryConnection,
        notificationsUnread,
        messagesUnread,
        getPendingMessages,
      }}
    >
      <div
        className={cn(
          "pointer-events-none fixed bottom-4 right-4 z-50 transform transition-all duration-500 ease-in-out max-sm:bottom-20",
          showStatus ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0",
        )}
      >
        {isConnected ? (
          <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/75 px-4 py-2 text-emerald-600 shadow-md dark:border-emerald-800 dark:bg-emerald-900/75 dark:text-emerald-400">
            <Wifi className="h-4 w-4" />
            <span className="text-xs font-semibold">{t().connected}</span>
          </div>
        ) : isConnecting ? (
          <div className="flex animate-pulse items-center gap-2 rounded-full border border-amber-200 bg-amber-500/10 px-4 py-2 text-amber-600 shadow-md dark:border-amber-800 dark:bg-amber-900/50">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs font-semibold">{t().reconnecting}</span>
          </div>
        ) : (
          <div className="h-7 border-destructive/50 flex items-center gap-2 rounded-full border  text-destructive bg-destructive/10 px-4 py-2 hover:text-destructive-foreground">
            <WifiOff className="h-4 w-4" />
            <span className="text-xs font-semibold">
              {t().realtimeServerOffline}
            </span>
          </div>
        )}
      </div>
      {children}
    </SocketContext.Provider>
  );
}
