import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSocket } from "@/components/providers/SocketProvider";
import kyInstance from "@/lib/ky";
import { ReadInfo } from "@/lib/types";

export default function useMessageReads(messageId?: string) {
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const queryKey = ["message", "views", messageId ?? ""];

  const { data } = useQuery({
    queryKey,
    queryFn: () => {
      if (!messageId)
        throw new Error("A message ID is required to load reads.");
      return kyInstance
        .get(`/api/messages/${messageId}/reads`, { throwHttpErrors: false })
        .json<ReadInfo>();
    },
    enabled: !!messageId,
    staleTime: Infinity,
    throwOnError: false,
  });

  useEffect(() => {
    if (!socket || !messageId) return;

    const handleReadUpdate = (event: ReadInfo & { messageId: string }) => {
      if (event.messageId !== messageId) return;
      queryClient.setQueryData<ReadInfo>(queryKey, { reads: event.reads });
    };

    socket.on("message_read_update", handleReadUpdate);
    return () => {
      socket.off("message_read_update", handleReadUpdate);
    };
  }, [messageId, queryClient, socket]);

  return data?.reads ?? [];
}
