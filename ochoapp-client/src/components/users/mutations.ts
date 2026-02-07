import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../ui/use-toast";
import { updateUser } from "./action";
import { t } from "@/context/LanguageContext";

export function useUpdateUserMutation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { userUpdated, unableToUpdateUser } = t();

  const mutation = useMutation({
    mutationFn: updateUser,
    onSuccess: async () => {
      // Invalidate user-related queries
      await queryClient.invalidateQueries({ queryKey: ["user"] });
      await queryClient.invalidateQueries({ queryKey: ["session"] });

      toast({
        description: userUpdated,
      });
    },
    onError(error) {
      console.error(error);
      toast({
        variant: "destructive",
        description: unableToUpdateUser,
      });
    },
  });

  return mutation;
}
