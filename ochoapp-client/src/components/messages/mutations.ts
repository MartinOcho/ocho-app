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
  createChatRoom,
  deleteMessage,
  leaveGroup,
  removeMember,
  restoreMember,
  saveMessage,
  submitMessage,
} from "./actions";
import { RoomsSection, MessagesSection } from "@/lib/types";
import { t } from "@/context/LanguageContext";

export function useSubmitMessageMutation() {
  const { toast } = useToast();
  const { unableToSendThisMessage } = t();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: submitMessage,
    onSuccess: async ({ newMessage, roomId, newRoom, userId }) => {
      const isSavedMessage = roomId === `saved-${userId}`;
      newMessage.type = "CONTENT";
      const messageQueryKey = isSavedMessage
        ? ["messages", `saved-${userId}`]
        : ["messages", roomId];
      const roomQueryKey = ["chat-rooms", userId];

      // 1. Update the message cache
      const cachedMessages =
        queryClient.getQueryData<InfiniteData<MessagesSection, string | null>>(
          messageQueryKey,
        );

      const messageExists = cachedMessages?.pages.some((page) =>
        page.messages.some((message) => message.id === newMessage.id),
      );
      if (!messageExists) {
        queryClient.setQueryData<InfiniteData<MessagesSection, string | null>>(
          messageQueryKey,
          (oldData) => {
            if (!oldData) return;
            return {
              ...oldData,
              pages: oldData.pages.map((page) => ({
                ...page,
                messages: [newMessage, ...page.messages],
              })),
              pageParams: oldData.pageParams,
            };
          },
        );
      }

      // 2. Update the room cache if not a saved message
      if (!isSavedMessage) {
        const cachedRooms =
          queryClient.getQueryData<
            InfiniteData<RoomsSection, string | null>
          >(roomQueryKey);

        const roomIndex = cachedRooms?.pages
          .flatMap((page, pageIndex) =>
            page.rooms.map((room, index) => ({
              room,
              pageIndex,
              index,
            })),
          )
          .find(({ room }) => room.id === roomId);

        if (roomIndex) {
          // Move the existing room to the beginning
          queryClient.setQueryData<
            InfiniteData<RoomsSection, string | null>
          >(roomQueryKey, (oldData) => {
            if (!oldData) return;

            const { pageIndex, index } = roomIndex;
            const room = oldData.pages[pageIndex].rooms[index];

            return {
              ...oldData,
              pages: oldData.pages.map((page, idx) => {
                if (idx === 0) {
                  return {
                    ...page,
                    rooms: [
                      {
                        ...room,
                        messages: [newMessage],
                      },
                      ...page.rooms.filter((ch) => ch.id !== room.id),
                    ],
                  };
                }
                if (idx === pageIndex) {
                  return {
                    ...page,
                    rooms: page.rooms.filter(
                      (ch) => ch.id !== room.id,
                    ),
                  };
                }
                return page;
              }),
              pageParams: oldData.pageParams,
            };
          });
        } else if (newRoom) {
          // Add the new room
          queryClient.setQueryData<
            InfiniteData<RoomsSection, string | null>
          >(roomQueryKey, (oldData) => {
            if (!oldData) return;
            return {
              ...oldData,
              pages: oldData.pages.map((page, idx) => {
                if (idx === 0) {
                  return {
                    ...page,
                    rooms: [newRoom, ...page.rooms],
                  };
                }
                return page;
              }),
              pageParams: oldData.pageParams,
            };
          });
        }
      }
    },
    onError(error) {
      console.error(error);
      toast({
        variant: "destructive",
        description: unableToSendThisMessage,
      });
    },
  });

  return mutation;
}

export function useSaveMessageMutation() {
  const { toast } = useToast();
  const { youCanChat, somethingWentWrong } = t();

  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: saveMessage,
    onSuccess: async ({ newRoom, userId }) => {
      const queryKey = ["chat-rooms", userId];
      await queryClient.invalidateQueries({ queryKey });
      toast({
        description: youCanChat,
      });
      return newRoom;
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

export function useDeleteMessageMutation() {
  const { toast } = useToast();
  const { unableToDeleteMessage } = t();

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: deleteMessage,
    onSuccess: async (deletedMessage) => {
      const queryKey: QueryKey = ["messages", deletedMessage.roomId];

      const readsKey: QueryKey = ["reads-info", deletedMessage.id];

      await queryClient.cancelQueries({ queryKey: readsKey });
      await queryClient.invalidateQueries({ queryKey });
    },
    onError(error) {
      console.error(error);
      toast({
        variant: "destructive",
        description: unableToDeleteMessage,
      });
    },
  });

  return mutation;
}

export function useCreateChatRoomMutation() {
  const { toast } = useToast();
  const {youCanChat, somethingWentWrong} = t()

  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: createChatRoom,
    onSuccess: async ({ newRoom, userId }) => {
      const queryKey = ["chat-rooms", userId];
      await queryClient.invalidateQueries({ queryKey });

      toast({
        description: youCanChat,
      });
      return newRoom;
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
export function useAddMemberMutation() {
  const { toast } = useToast();
  const { somethingWentWrong, groupAddError, groupAddSuccess } = t()

  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: addMembers,
    onSuccess: async ({ newMembersList, userId }) => {
      const queryKey = ["chat-rooms", userId];
      // Vérifier si createInfo est défini avant de l'assigner à newMessage
      if (!newMembersList.length) {
        toast({
          variant: "destructive",
          description:
            groupAddError,
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey });

      toast({
        description: groupAddSuccess,
      });
      return { newMembersList };
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

  const mutation = useMutation({
    mutationFn: addAdmin,
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

  const mutation = useMutation({
    mutationFn: removeMember,
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

  const mutation = useMutation({
    mutationFn: banMember,
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

  const mutation = useMutation({
    mutationFn: restoreMember,
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

  const mutation = useMutation({
    mutationFn: leaveGroup,
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
