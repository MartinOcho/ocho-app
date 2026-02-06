"use client";

import InfiniteScrollContainer from "@/components/InfiniteScrollContainer";
import kyInstance from "@/lib/ky";
import { NotificationsPage } from "@/lib/types";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Bell, Frown, Loader2 } from "lucide-react";
import Notification from "./Notification";
import { useEffect, useMemo } from "react";
import NotificationsSkeleton from "./NotificationsSkeleton";
import { useSocket } from "@/components/providers/SocketProvider";

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

  const { mutate } = useMutation({
    mutationFn: () => kyInstance.patch("/api/notifications/mark-as-read"),
    onSuccess: () => {
      queryClient.setQueryData(["unread-notifications"], {
        unreadCount: 0,
      });
    },
    onError(error) {
      console.error("Impossible de marquer comme lu.", error);
    },
  });

  useEffect(() => {
    mutate();
  }, [mutate]);

  // Listener pour les nouvelles notifications via socket
  useEffect(() => {
    if (!socket?.connected) return;

    const onNotificationReceived = (notification: any) => {
      queryClient.setQueryData(["notifications"], (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          pages: [
            {
              previousCursor: oldData.pages[0]?.previousCursor,
              notifications: [notification, ...oldData.pages[0]?.notifications || []],
            },
            ...oldData.pages.slice(1),
          ],
        };
      });
    };

    const onNotificationDeleted = (data: any) => {
      queryClient.setQueryData(["notifications"], (oldData: any) => {
        if (!oldData) return oldData;

        const filterNotifications = (notifs: any[]) =>
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

    socket.on("notification_received", onNotificationReceived);
    socket.on("notification_deleted", onNotificationDeleted);

    return () => {
      socket.off("notification_received", onNotificationReceived);
      socket.off("notification_deleted", onNotificationDeleted);
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