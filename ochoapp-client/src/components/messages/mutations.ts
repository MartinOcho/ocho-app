import { useToast } from "@/components/ui/use-toast";
import {
  InfiniteData,
  QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  addAdmin,
  addMembers,
  banMember,
  deleteMessage,
  leaveGroup,
  removeMember,
  restoreMember,
} from "./actions";
import { t } from "@/context/LanguageContext";
import { useSocket } from "@/components/providers/SocketProvider";
import { useCallback } from "react";

// Hook pour les mutations via socket
export function useSocketMutation<T, V>(
  eventName: string,
  onSuccess?: (data: T) => void,
  onError?: (error: Error) => void
) {
  const { socket, isConnected } = useSocket();
  const { toast } = useToast();

  return useCallback(
    (input: V) => {
      return new Promise<T>((resolve, reject) => {
        if (!socket || !isConnected) {
          const error = new Error("Socket non connecté");
          onError?.(error);
          reject(error);
          return;
        }

        socket.emit(eventName, input, (response: any) => {
          if (response?.success) {
            const data = response.data as T;
            onSuccess?.(data);
            resolve(data);
          } else {
            const error = new Error(response?.error || "Erreur serveur");
            onError?.(error);
            reject(error);
          }
        });
      });
    },
    [socket, isConnected, eventName, onSuccess, onError]
  );
}


export function useAddMemberMutation() {
  const { toast } = useToast();
  const { somethingWentWrong, groupAddError, groupAddSuccess } = t()
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  const mutation = useMutation({
    mutationFn: async (input: { roomId: string; members: string[] }) => {
      return new Promise<any>((resolve, reject) => {
        if (!socket || !isConnected) {
          return reject(new Error("Socket non connecté"));
        }

        socket.emit("group_add_members", input, (response: any) => {
          if (response?.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || somethingWentWrong));
          }
        });
      });
    },
    onSuccess: async ({ roomId }) => {
      const queryKey = ["chat-rooms"];
      queryClient.invalidateQueries({ queryKey });

      toast({
        description: groupAddSuccess,
      });
      return { roomId };
    },
    onError(error) {
      console.error(error);
      toast({
        variant: "destructive",
        description: somethingWentWrong,
      });
    },
  });
  return mutation;
}
export function useAddAdminMutation() {
  const { toast } = useToast();
  const { somethingWentWrong } = t()
  const { socket, isConnected } = useSocket();

  const mutation = useMutation({
    mutationFn: async (input: { roomId: string; member: string }) => {
      return new Promise<any>((resolve, reject) => {
        if (!socket || !isConnected) {
          return reject(new Error("Socket non connecté"));
        }

        socket.emit("group_add_admin", input, (response: any) => {
          if (response?.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || somethingWentWrong));
          }
        });
      });
    },
    onSuccess: ({ newRoomMember }) => {
      return { newRoomMember };
    },
    onError(error) {
      console.error(error);
      toast({
        variant: "destructive",
        description: somethingWentWrong,
      });
    },
  });
  return mutation;
}
export function useRemoveMemberMutation() {
  const { toast } = useToast();
  const { somethingWentWrong } = t()
  const { socket, isConnected } = useSocket();

  const mutation = useMutation({
    mutationFn: async (input: { roomId: string; memberId: string }) => {
      return new Promise<any>((resolve, reject) => {
        if (!socket || !isConnected) {
          return reject(new Error("Socket non connecté"));
        }

        socket.emit("group_remove_member", input, (response: any) => {
          if (response?.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || somethingWentWrong));
          }
        });
      });
    },
    onError(error) {
      console.error(error);
      toast({
        variant: "destructive",
        description: somethingWentWrong,
      });
    },
  });
  return mutation;
}
export function useBanMemberMutation() {
  const { toast } = useToast();
  const { somethingWentWrong } = t()
  const { socket, isConnected } = useSocket();

  const mutation = useMutation({
    mutationFn: async (input: { roomId: string; memberId: string }) => {
      return new Promise<any>((resolve, reject) => {
        if (!socket || !isConnected) {
          return reject(new Error("Socket non connecté"));
        }

        socket.emit("group_ban_member", input, (response: any) => {
          if (response?.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || somethingWentWrong));
          }
        });
      });
    },
    onError(error) {
      console.error(error);
      toast({
        variant: "destructive",
        description: somethingWentWrong,
      });
    },
  });
  return mutation;
}
export function useRestoreMemberMutation() {
  const { toast } = useToast();
  const { somethingWentWrong } = t()
  const { socket, isConnected } = useSocket();

  const mutation = useMutation({
    mutationFn: async (input: { roomId: string; memberId: string }) => {
      return new Promise<any>((resolve, reject) => {
        if (!socket || !isConnected) {
          return reject(new Error("Socket non connecté"));
        }

        socket.emit("group_restore_member", input, (response: any) => {
          if (response?.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || somethingWentWrong));
          }
        });
      });
    },
    onError(error) {
      console.error(error);
      toast({
        variant: "destructive",
        description: somethingWentWrong,
      });
    },
  });
  return mutation;
}

export function useLeaveGroupMutation() {
  const { toast } = useToast();
  const { somethingWentWrong } = t()
  const { socket, isConnected } = useSocket();

  const mutation = useMutation({
    mutationFn: async (input: { roomId: string; deleteGroup?: boolean }) => {
      return new Promise<any>((resolve, reject) => {
        if (!socket || !isConnected) {
          return reject(new Error("Socket non connecté"));
        }

        socket.emit("group_leave", input, (response: any) => {
          if (response?.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || somethingWentWrong));
          }
        });
      });
    },
    onError(error) {
      console.error(error);
      toast({
        variant: "destructive",
        description: somethingWentWrong,
      });
    },
  });
  return mutation;
}
