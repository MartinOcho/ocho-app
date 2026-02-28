import {
  InfiniteData,
  QueryFilters,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useToast } from "../ui/use-toast";
import { usePathname } from "next/navigation";
import { deletePost } from "./actions";
import { PostsPage } from "@/lib/types";
import { useProgress } from "@/context/ProgressContext";
import { useTranslation } from "@/context/LanguageContext";
import { useSocket } from "../providers/SocketProvider";

export function useDeletePostMutation() {
  const { socket } = useSocket();

  const { toast } = useToast();

  const { t } = useTranslation();

  const { postDeleted, unableToDeletePost } = t();

  const queryClient = useQueryClient();

  const { startNavigation: navigate } = useProgress();

  const pathname = usePathname();

  const mutation = useMutation({
    mutationFn: deletePost,
    onSuccess: async (deletedPost) => {
      const queryFilter: QueryFilters = { queryKey: ["post-feed"] };

      socket?.emit("delete_many_notifications", {
          postId: deletedPost.id,
      });

      await queryClient.cancelQueries(queryFilter);

      queryClient.setQueriesData<InfiniteData<PostsPage, string | null>>(
        queryFilter,
        (oldData) => {
          const firstPage = oldData?.pages[0];
          if (firstPage) {
            return {
              pageParams: oldData.pageParams,
              pages: oldData.pages.map((page) => ({
                nextCursor: page.nextCursor,
                posts: page.posts.filter((p) => p.id !== deletedPost.id),
              })),
            };
          }
        },
      );

      toast({
        description: postDeleted,
      });

      if (pathname.startsWith(`/posts/${deletedPost.id}`)) {
        navigate(`/users/${deletedPost.user.username}`);
      }
    },
    onError(error) {
      console.error(error);
      toast({
        variant: "destructive",
        description: unableToDeletePost,
      });
    },
  });

  return mutation;
}
