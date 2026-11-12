import { useToast } from "@/components/ui/use-toast";
import {
  InfiniteData,
  QueryFilters,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { submitPost, updatePost } from "./actions";
import { PostsPage } from "@/lib/types";
import { useSession } from "@/app/(main)/SessionProvider";
import { useTranslation } from "@/context/LanguageContext";
import { useRouter } from "next/navigation";

export function useSubmitPostMutation() {
  const { toast } = useToast();

  const { t } = useTranslation();

  const { postSuccess, postError } = t();

  const queryClient = useQueryClient();

  const { user } = useSession();

  const mutation = useMutation({
    mutationFn: submitPost,
    onSuccess: async (newPost) => {
      const queryFilter = {
        queryKey: ["post-feed"],
        predicate(query) {
          return (
            query.queryKey.includes("for-you") ||
            (query.queryKey.includes("user-posts") &&
              query.queryKey.includes(user.id))
          );
        },
      } satisfies QueryFilters;

      await queryClient.cancelQueries(queryFilter);

      queryClient.setQueriesData<InfiniteData<PostsPage, string | null>>(
        queryFilter,
        (oldData) => {
          const firstPage = oldData?.pages[0];
          if (firstPage) {
            return {
              pageParams: oldData.pageParams,
              pages: [
                {
                  posts: [newPost, ...firstPage.posts],
                  nextCursor: firstPage.nextCursor,
                },
                ...oldData.pages.slice(1),
              ],
            };
          }
        },
      );

      queryClient.invalidateQueries({
        queryKey: queryFilter.queryKey,
        predicate(query) {
          return queryFilter.predicate(query) && !query.state.data;
        },
      });

      toast({
        description: postSuccess,
      });
    },
    onError(error) {
      console.error(error);
      toast({
        variant: "destructive",
        description: postError,
      });
    },
  });

  return mutation;
}

export function useUpdatePostMutation() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { postUpdated, postUpdateError } = t();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updatePost,
    onSuccess: async (updatedPost) => {
      await queryClient.cancelQueries({ queryKey: ["post-feed"] });
      queryClient.setQueriesData<InfiniteData<PostsPage, string | null>>(
        { queryKey: ["post-feed"] },
        (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              posts: page.posts.map((post) =>
                post.id === updatedPost.id ? updatedPost : post,
              ),
            })),
          };
        },
      );
      await queryClient.invalidateQueries({ queryKey: ["post-feed"] });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["comments", updatedPost.id],
        }),
        queryClient.invalidateQueries({ queryKey: ["replies"] }),
      ]);
      router.refresh();
      toast({ description: postUpdated });
    },
    onError(error) {
      console.error(error);
      toast({ variant: "destructive", description: postUpdateError });
    },
  });
}
