import { CommentData, LikeInfo } from "@/lib/types";
import { useToast } from "../../ui/use-toast";
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
import { useSession } from "@/app/(main)/SessionProvider";
import { useEffect } from "react";
import { useTranslation } from "@/context/LanguageContext";

interface LikeButtonProps {
  comment: CommentData;
  initialState: LikeInfo;
  onAuthorLikeChange: (liked: boolean) => void;
}

export default function LikeButton({
  comment,
  initialState,
  onAuthorLikeChange,
}: LikeButtonProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const { like: likeText, likes: likesText, unLike, somethingWentWrong } = t();
  const { socket } = useSocket();
  const commentId = comment.id;

  const queryClient = useQueryClient();
  const {user} = useSession();

  const queryKey: QueryKey = ["like-info", commentId];

  const { data } = useQuery({
    queryKey,
    queryFn: () =>
      kyInstance.get(`/api/posts/comments/${commentId}/likes`).json<LikeInfo>(),
    initialData: initialState,
    staleTime: Infinity,
  });

  const { mutate } = useMutation({
    mutationFn: () =>
      data.isLikedByUser
        ? kyInstance.delete(`/api/posts/comments/${commentId}/likes`)
        : kyInstance.post(`/api/posts/comments/${commentId}/likes`),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });

      const previousState = queryClient.getQueryData<LikeInfo>(queryKey);

      queryClient.setQueryData<LikeInfo>(queryKey, () => ({
        likes:
          (previousState?.likes || 0) + (previousState?.isLikedByUser ? -1 : 1),
        isLikedByUser: !previousState?.isLikedByUser,
        isLikedByAuthor: comment.post.userId === user.id && !previousState?.isLikedByUser,
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

  useEffect(()=>{
    onAuthorLikeChange(data?.isLikedByAuthor || false);
  }, [data.isLikedByAuthor, onAuthorLikeChange])

  const handleLike = () => {
    const isCurrentlyLiked = data.isLikedByUser;
    
    // Émettre les événements socket immédiatement
    if (socket?.connected) {
      if (!isCurrentlyLiked) {
        // Créer la notification
        socket.emit("create_notification", {
          type: "COMMENT_LIKE",
          recipientId: comment.userId,
          commentId: comment.id,
          postId: comment.postId,
        });
      } else {
        // Supprimer la notification
        socket.emit("delete_notification", {
          type: "COMMENT_LIKE",
          recipientId: comment.userId,
          commentId: comment.id,
          postId: comment.postId,
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
      {!!data.likes && <span>{data.likes}</span>}
    </button>
  );
}
