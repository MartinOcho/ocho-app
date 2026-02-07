"use client";

import useFollowerInfo from "@/hooks/useFollowerInfo";
import { FollowerInfo } from "@/lib/types";
import { useToast } from "./ui/use-toast";
import { QueryKey, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import kyInstance from "@/lib/ky";
import { useSocket } from "@/components/providers/SocketProvider";
import { VocabularyKey } from "@/lib/vocabulary";
import { useTranslation } from "@/context/LanguageContext";

interface FollowButtonProps {
  userId: string;
  initialState: FollowerInfo;
}

export default function FollowButton({
  userId,
  initialState,
}: FollowButtonProps) {
  const { t } = useTranslation();

  const { toast } = useToast();
  const { socket } = useSocket();
  const {
    somethingWentWrong,
    friend,
    follow,
    following,
    followBack,
    unFollow,
  } = t();

  const queryClient = useQueryClient();

  const { data } = useFollowerInfo(userId, initialState);

  const queryKey: QueryKey = ["follower-info", userId];

  const { mutate } = useMutation({
    mutationFn: () =>
      data.isFollowedByUser
        ? kyInstance.delete(`/api/users/${userId}/followers`)
        : kyInstance.post(`/api/users/${userId}/followers`),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });

      const previousState = queryClient.getQueryData<FollowerInfo>(queryKey);

      queryClient.setQueryData<FollowerInfo>(queryKey, () => ({
        followers:
          (previousState?.followers || 0) +
          (previousState?.isFollowedByUser ? -1 : 1),
        isFollowedByUser: !previousState?.isFollowedByUser,
        isFolowing: !previousState?.isFolowing,
        isFriend: previousState?.isFolowing && !previousState?.isFriend,
      }));

      return { previousState };
    },
    onError(error, variable, context) {
      queryClient.setQueryData(queryKey, context?.previousState);
      console.error(error);
      toast({
        variant: "destructive",
        description: somethingWentWrong,
      });
    },
  });

  const handleFollow = () => {
    const isCurrentlyFollowed = data.isFollowedByUser;
    
    // Émettre les événements socket immédiatement
    if (socket?.connected) {
      if (!isCurrentlyFollowed) {
        // Créer la notification
        socket.emit("create_notification", {
          type: "FOLLOW",
          recipientId: userId,
        });
      } else {
        // Supprimer la notification
        socket.emit("delete_notification", {
          type: "FOLLOW",
          recipientId: userId,
        });
      }
    }
    
    // Faire la mutation en arrière-plan
    mutate();
  };

  const { isFriend, isFolowing } = data;

  const followingText = isFriend ? friend : following;
  const notFollowingText = isFolowing ? followBack : follow;

  return (
    <Button
      variant={data.isFollowedByUser ? "secondary" : "default"}
      title={data.isFollowedByUser ? unFollow : follow}
      onClick={handleFollow}
    >
      {data.isFollowedByUser ? followingText : notFollowingText}
    </Button>
  );
}
