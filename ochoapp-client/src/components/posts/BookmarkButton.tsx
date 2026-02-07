import { BookmarkInfo } from "@/lib/types";
import { useToast } from "../ui/use-toast";
import {
  QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import kyInstance from "@/lib/ky";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { VocabularyKey } from "@/lib/vocabulary";
import { useTranslation } from "@/context/LanguageContext";

interface BookmarkButtonProps {
  postId: string;
  initialState: BookmarkInfo;
}

export default function BookmarkButton({
  postId,
  initialState,
}: BookmarkButtonProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const {
    addToBookmarks,
    addedToBookmarks,
    removeFromBookmarks,
    removedFromBookmarks,
    somethingWentWrong
  } = t();

  const queryClient = useQueryClient();

  const queryKey: QueryKey = ["bookmark-info", postId];

  const { data } = useQuery({
    queryKey,
    queryFn: () =>
      kyInstance.get(`/api/posts/${postId}/bookmark`).json<BookmarkInfo>(),
    initialData: initialState,
    staleTime: Infinity,
  });

  const { mutate } = useMutation({
    mutationFn: () =>
      data.isBookmarkedByUser
        ? kyInstance.delete(`/api/posts/${postId}/bookmark`)
        : kyInstance.post(`/api/posts/${postId}/bookmark`),
    onMutate: async () => {
      toast({
        description: data.isBookmarkedByUser
          ? removeFromBookmarks
          : addedToBookmarks,
      });

      await queryClient.cancelQueries({ queryKey });

      const previousState = queryClient.getQueryData<BookmarkInfo>(queryKey);

      queryClient.setQueryData<BookmarkInfo>(queryKey, () => ({
        isBookmarkedByUser: !previousState?.isBookmarkedByUser,
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

  return (
    <button
      title={
        data.isBookmarkedByUser ? removeFromBookmarks : addToBookmarks
      }
      onClick={() => mutate()}
      className="flex items-center gap-1"
    >
      <Bookmark
        className={cn(
          "size-5",
          data.isBookmarkedByUser && "fill-yellow-500 text-yellow-500",
        )}
      />
    </button>
  );
}
