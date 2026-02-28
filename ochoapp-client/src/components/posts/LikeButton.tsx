import { LikeInfo } from "@/lib/types";
import { useToast } from "../ui/use-toast";
import {
  QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import kyInstance from "@/lib/ky";
import { useSocket } from "@/components/providers/SocketProvider";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/context/LanguageContext";

interface LikeButtonProps {
  postId: string;
  initialState: LikeInfo;
  recipientId?: string;
}

export default function LikeButton({ postId, initialState, recipientId }: LikeButtonProps) {
  const { toast } = useToast();

  const { t } = useTranslation();

  const { like: likeText, likes: likesText, unLike, somethingWentWrong } = t();
  const { socket } = useSocket();

  const queryClient = useQueryClient();

  const queryKey: QueryKey = ["like-info", postId];

  const { data } = useQuery({
    queryKey,
    queryFn: () =>
      kyInstance.get(`/api/posts/${postId}/likes`).json<LikeInfo>(),
    initialData: initialState,
    staleTime: Infinity,
  });

  const { mutate } = useMutation({
    mutationFn: () =>
      data.isLikedByUser
        ? kyInstance.delete(`/api/posts/${postId}/likes`)
        : kyInstance.post(`/api/posts/${postId}/likes`),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });

      const previousState = queryClient.getQueryData<LikeInfo>(queryKey);

      queryClient.setQueryData<LikeInfo>(queryKey, () => ({
        likes:
          (previousState?.likes || 0) + (previousState?.isLikedByUser ? -1 : 1),
        isLikedByUser: !previousState?.isLikedByUser,
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

  const handleLike = () => {
    const isCurrentlyLiked = data.isLikedByUser;
    
    // Émettre les événements socket immédiatement
    if (recipientId && socket?.connected) {
      if (!isCurrentlyLiked) {
        // Créer la notification
        socket.emit("create_notification", {
          type: "LIKE",
          recipientId,
          postId,
        });
      } else {
        // Supprimer la notification
        socket.emit("delete_notification", {
          type: "LIKE",
          recipientId,
          postId,
        });
      }
    }
    
    // Faire la mutation en arrière-plan
    mutate();
  };

  return (
    <button
      title={data.isLikedByUser ? unLike : likeText}
      onClick={handleLike}
      className="flex items-center gap-1"
    >
      <Heart
        className={cn(
          "size-5",
          data.isLikedByUser && "fill-red-500 text-red-500",
        )}
      />
      {!!data.likes && (
        <>
          <span>{data.likes}</span>
          {!!data.likes && (
            <span className="hidden sm:inline">
              {data.likes > 1 ? likesText : likeText}
            </span>
          )}
        </>
      )}
    </button>
  );
}
