"use client";

import { Button } from "@/components/ui/button";
import { t } from "@/context/LanguageContext";
import kyInstance from "@/lib/ky";
import { NotificationCountInfo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircleMore } from "lucide-react";
import OchoLink from "@/components/ui/OchoLink";
import { usePathname } from "next/navigation";
import { useSocket } from "@/components/providers/SocketProvider";
import { useEffect } from "react";

interface MessagesButtonProps {
  initialState: NotificationCountInfo;
  className?: string;
}

export default function MessagesButton({
  initialState,
  className,
}: MessagesButtonProps) {
  const pathname = usePathname();
  const isMessagesPage = pathname.startsWith("/messages");
  
  // 1. Récupération du socket et du client de requête
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();

  const { messages } = t(['messages']);

  // 2. Requête pour obtenir le nombre de rooms non lues
  const queryKey = ["unread", "rooms", "count"];

  const { data } = useQuery({
    queryKey,
    queryFn: () =>
      kyInstance
        .get("/api/rooms/unread-count")
        .json<NotificationCountInfo>(),
    initialData: initialState,
    // On ne refetch pas automatiquement au focus pour éviter le spam, 
    // on laisse le socket gérer les mises à jour
    refetchOnWindowFocus: false, 
  });

  // 3. Effet pour écouter les événements Socket
  useEffect(() => {
    if (!socket || !isConnected) return;

    // A. Écoute du nouvel événement EXACT (Server Push)
    // Le serveur nous envoie maintenant le nombre précis de salons non lus
    // après vérification en base de données.
    const handleUnreadUpdate = ({ unreadCount }: { unreadCount: number }) => {
        // Mise à jour directe du cache sans refetch HTTP
        queryClient.setQueryData<NotificationCountInfo>(queryKey, (old) => {
            return {
                ...old,
                unreadCount: unreadCount
            } as NotificationCountInfo;
        });
    };

    // B. Fallback : rafraîchissement complet en cas de doute ou suppression
    const refreshUnreadCount = () => {
      queryClient.invalidateQueries({ queryKey });
    };

    socket.on("rooms_unreads_update", handleUnreadUpdate);
    
    // On garde l'écouteur de suppression au cas où, qui trigger un refetch
    socket.on("message_deleted", refreshUnreadCount);
    
    // Idem si on quitte un groupe
    socket.on("left_room", refreshUnreadCount);
    // Idem si on rejoint un groupe (optionnel si géré par start_chat)
    socket.on("added_to_group", refreshUnreadCount);


    return () => {
      // Nettoyage des écouteurs
      socket.off("rooms_unreads_update", handleUnreadUpdate);
      socket.off("message_deleted", refreshUnreadCount);
      socket.off("left_room", refreshUnreadCount);
      socket.off("added_to_group", refreshUnreadCount);
    };
  }, [socket, isConnected, queryClient]);

  const { unreadCount } = data;

  return (
    <Button
      variant="ghost"
      className={cn(
        "flex items-center justify-start max-sm:h-fit max-sm:flex-1 max-sm:p-1.5 sm:gap-3",
        className,
      )}
      title={messages}
      asChild
    >
      <OchoLink
        href="/messages"
        className={cn("items-center max-sm:flex max-sm:flex-col text-inherit", className)}
      >
        <div className="relative">
          <MessageCircleMore />
          {!!unreadCount && (
            <span className="absolute -right-1 -top-1 rounded-full bg-[#dc143c] border-background border-[1px] px-1 text-xs font-medium tabular-nums text-white animate-in zoom-in duration-300">
              {unreadCount > 15 ? "15+" : unreadCount}
            </span>
          )}
        </div>
        <span className="text-[0.65rem] max-sm:font-thin sm:hidden">{messages}</span>
        <span className={cn("max-lg:hidden", isMessagesPage && "hidden")}>{messages}</span>
      </OchoLink>
    </Button>
  );
}