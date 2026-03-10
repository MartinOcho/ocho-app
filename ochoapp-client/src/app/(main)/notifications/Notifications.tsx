"use client";

import InfiniteScrollContainer from "@/components/InfiniteScrollContainer";
import { NotificationsPage, NotificationData } from "@/lib/types";
import {
  useInfiniteQuery,
  useQueryClient,
  InfiniteData,
} from "@tanstack/react-query";
import { Bell, Frown, Loader2 } from "lucide-react";
import Notification from "./Notification";
import { useEffect, useMemo } from "react";
import NotificationsSkeleton from "./NotificationsSkeleton";
import { useSocket } from "@/components/providers/SocketProvider";
import kyInstance from "@/lib/ky";

export default function Notifications() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ["notifications"],
    queryFn: ({ pageParam }) =>
      kyInstance
        .get(
          "/api/notifications",
          pageParam ? { searchParams: { cursor: pageParam } } : {},
        )
        .json<NotificationsPage>(),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const queryClient = useQueryClient();
  const { socket } = useSocket();

  // as soon as the socket is connected we ask the server
  // to mark all the current user's notifications as read
  useEffect(() => {
    if (!socket?.connected) return;
    socket.emit("mark_all_notifications_read");
  }, [socket]);

  // Listener pour les nouvelles notifications via socket
  useEffect(() => {
    if (!socket?.connected) return;

    const onNotificationReceived = (notification: NotificationData) => {
      queryClient.setQueryData(["notifications"], (oldData: InfiniteData<NotificationsPage> | undefined) => {
        if (!oldData) return oldData;

        // Vérifier si la notification existe déjà pour éviter les doublons
        const allExistingNotifications = oldData.pages.flatMap((page) => page.notifications);
        const alreadyExists = allExistingNotifications.some((n) => n.id === notification.id);

        if (alreadyExists) {
          return oldData; // Ignorer le doublon
        }

        return {
          ...oldData,
          pages: [
            {
              nextCursor: oldData.pages[0]?.nextCursor,
              notifications: [notification, ...oldData.pages[0]?.notifications || []],
            },
            ...oldData.pages.slice(1),
          ],
        };
      });
    };

    const onNotificationDeleted = (data: { commentId?: string; postId?: string; type: string }) => {
      queryClient.setQueryData(["notifications"], (oldData: InfiniteData<NotificationsPage> | undefined) => {
        if (!oldData) return oldData;

        const filterNotifications = (notifs: NotificationData[]) =>
          notifs.filter((n) => {
            // Supprimer si c'est le même commentId/postId et type
            if (data.commentId && n.commentId === data.commentId && data.type === n.type) {
              return false;
            }
            if (data.postId && n.postId === data.postId && data.type === n.type && !data.commentId) {
              return false;
            }
            return true;
          });

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            notifications: filterNotifications(page.notifications),
          })),
        };
      });
    };

    // mark all read event - update cache
    const onAllRead = () => {
      queryClient.setQueryData(["notifications"], (oldData: InfiniteData<NotificationsPage> | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            notifications: page.notifications.map((n) => ({ ...n, read: true })),
          })),
        };
      });
    };

    // individual notification read
    const onNotificationRead = (updated: NotificationData) => {
      queryClient.setQueryData(["notifications"], (oldData: InfiniteData<NotificationsPage> | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            notifications: page.notifications.map((n) =>
              n.id === updated.id ? { ...n, read: updated.read } : n,
            ),
          })),
        };
      });
    };

    socket.on("notification_received", onNotificationReceived);
    socket.on("notification_deleted", onNotificationDeleted);
    socket.on("all_notifications_marked_as_read", onAllRead);
    socket.on("notification_read", onNotificationRead);

    return () => {
      socket.off("notification_received", onNotificationReceived);
      socket.off("notification_deleted", onNotificationDeleted);
      socket.off("all_notifications_marked_as_read", onAllRead);
      socket.off("notification_read", onNotificationRead);
    };
  }, [socket, queryClient]);

  // Dédupliquer les notifications par ID
  const notifications = useMemo(() => {
    if (!data?.pages) return [];
    
    const allNotifications = data.pages.flatMap((page) => page.notifications);
    const seenIds = new Set<string>();
    
    return allNotifications.filter((notification) => {
      if (seenIds.has(notification.id)) {
        return false;
      }
      seenIds.add(notification.id);
      return true;
    });
  }, [data?.pages]);

  if (status === "pending") {
    return <NotificationsSkeleton />;
  }

  if (status === "success" && !notifications.length && !hasNextPage) {
    return (
      <div className="max-sm:pb-24 my-8 flex w-full flex-col items-center gap-2 text-center text-muted-foreground">
        <Bell size={150} />
        <h2 className="max-sm:pb-24 text-xl">Vos activités s&apos;afficheront ici.</h2>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="max-sm:pb-24 my-8 flex w-full flex-col items-center gap-2 text-center text-muted-foreground">
        <Frown size={150} />
        <h2 className="max-sm:pb-24 text-xl">Quelque chose s&apos;est mal passé.</h2>
      </div>
    );
  }

  return (
    <InfiniteScrollContainer
      className="max-sm:pb-24 space-y-2 sm:space-y-5 max-sm:py-1"
      onBottomReached={() => hasNextPage && !isFetching && fetchNextPage()}
    >
      {notifications.map((notification) => (
        <Notification key={notification.id} notification={notification} />
      ))}
      {isFetchingNextPage && <Loader2 className="max-sm:pb-24 mx-auto my-3 animate-spin" />}
    </InfiniteScrollContainer>
  );
}